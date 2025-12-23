"""
Face detection worker for TeddySnaps.
Optimized for M4 MacBook Air (16GB RAM).

Environment variables:
- SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_BUCKET (default: photos-originals)
- POLL_INTERVAL_SECONDS (default: 2)
- PHOTO_CONCURRENCY (default: 3, max 4 for M4 Air)
- DET_SIZE (default: 512, use 640 for higher quality)
- PROGRESS_UPDATE_INTERVAL (default: 3, update DB every N photos)
- UPSERT_BATCH_SIZE (default: 10, batch faces before upserting)
"""

import io
import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import requests
from dotenv import load_dotenv
from PIL import Image
from supabase import create_client

# InsightFace
from insightface.app import FaceAnalysis

try:
    import hdbscan  # type: ignore
except Exception:
    hdbscan = None

from sklearn.cluster import DBSCAN  # type: ignore


load_dotenv()


# Configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_BUCKET = os.environ.get("SUPABASE_BUCKET", "photos-originals")
POLL_INTERVAL_SECONDS = float(os.environ.get("POLL_INTERVAL_SECONDS", "2"))

# Performance tuning (optimized for M4 MacBook Air 16GB)
PHOTO_CONCURRENCY = int(os.environ.get("PHOTO_CONCURRENCY", "3"))
DET_SIZE = int(os.environ.get("DET_SIZE", "512"))  # 512 faster, 640 more accurate
PROGRESS_UPDATE_INTERVAL = int(os.environ.get("PROGRESS_UPDATE_INTERVAL", "3"))
UPSERT_BATCH_SIZE = int(os.environ.get("UPSERT_BATCH_SIZE", "10"))

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY")


@dataclass
class DetectedFace:
    photo_id: str
    bbox: Tuple[float, float, float, float]  # x, y, w, h
    det_score: float
    embedding: np.ndarray  # shape (512,)
    crop_webp: bytes
    crop_url: Optional[str] = None


# Reusable HTTP session for connection pooling
_http_session: Optional[requests.Session] = None


def get_http_session() -> requests.Session:
    global _http_session
    if _http_session is None:
        _http_session = requests.Session()
        # Connection pooling
        adapter = requests.adapters.HTTPAdapter(
            pool_connections=PHOTO_CONCURRENCY + 2,
            pool_maxsize=PHOTO_CONCURRENCY + 2,
        )
        _http_session.mount("http://", adapter)
        _http_session.mount("https://", adapter)
    return _http_session


def supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def fetch_one_job(sb) -> Optional[Dict[str, Any]]:
    res = (
        sb.table("face_jobs")
        .select("*")
        .eq("status", "queued")
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    return res.data[0]


def update_job(sb, job_id: str, patch: Dict[str, Any]) -> None:
    sb.table("face_jobs").update(patch).eq("id", job_id).execute()


def claim_job(sb, job_id: str) -> bool:
    res = (
        sb.table("face_jobs")
        .update({"status": "running", "message": "Starting...", "progress": 0.01})
        .eq("id", job_id)
        .eq("status", "queued")
        .execute()
    )
    return bool(res.data)


def list_photos_for_session(sb, session_id: str) -> List[Dict[str, Any]]:
    # Supabase/PostgREST commonly paginates responses (often 1000 rows).
    # Fetch all photos in pages to ensure we process the entire session.
    out: List[Dict[str, Any]] = []
    page_size = 1000
    # Optional: resume processing by skipping the first N photos (based on created_at order).
    # Useful when a previous run processed the first page only.
    offset = int(os.environ.get("PHOTO_OFFSET", "0") or "0")

    while True:
        res = (
            sb.table("photos")
            .select("id, original_url, thumbnail_url")
            .eq("session_id", session_id)
            .order("created_at", desc=False)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = res.data or []
        out.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    return out


def download_image(url: str, timeout: int = 30) -> Image.Image:
    session = get_http_session()
    r = session.get(url, timeout=timeout)
    r.raise_for_status()
    img = Image.open(io.BytesIO(r.content)).convert("RGB")
    return img


def pil_to_np_bgr(img: Image.Image) -> np.ndarray:
    arr = np.array(img)  # RGB
    return arr[:, :, ::-1].copy()  # BGR for InsightFace


def crop_face(img: Image.Image, bbox: Tuple[float, float, float, float], margin: float = 0.15) -> Image.Image:
    x, y, w, h = bbox
    W, H = img.size
    mx = w * margin
    my = h * margin
    x0 = max(0, int(x - mx))
    y0 = max(0, int(y - my))
    x1 = min(W, int(x + w + mx))
    y1 = min(H, int(y + h + my))
    return img.crop((x0, y0, x1, y1))


def encode_webp(img: Image.Image, quality: int = 80) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=quality, method=6)
    return buf.getvalue()


def upload_crop(sb, session_id: str, crop_bytes: bytes) -> str:
    face_id = str(uuid.uuid4())
    path = f"faces/{session_id}/{face_id}.webp"
    sb.storage.from_(SUPABASE_BUCKET).upload(
        path,
        crop_bytes,
        file_options={"content-type": "image/webp", "upsert": "true"},
    )
    public = sb.storage.from_(SUPABASE_BUCKET).get_public_url(path)
    return public


def upsert_discovered_faces(sb, session_id: str, faces: List[DetectedFace]) -> List[str]:
    payload = []
    for f in faces:
        x, y, w, h = f.bbox
        if not f.crop_url:
            continue
        payload.append(
            {
                "session_id": session_id,
                "photo_id": f.photo_id,
                "face_descriptor": f.embedding.astype(float).tolist(),
                "crop_url": f.crop_url,
                "detection_score": float(f.det_score),
                "bbox_x": float(x),
                "bbox_y": float(y),
                "bbox_width": float(w),
                "bbox_height": float(h),
                "is_named": False,
                "is_skipped": False,
            }
        )

    if not payload:
        return []

    res = sb.table("discovered_faces").upsert(
        payload,
        on_conflict="photo_id,bbox_x,bbox_y,bbox_width,bbox_height",
        returning="representation",
    ).execute()
    return [row["id"] for row in (res.data or [])]


def cluster_embeddings(embeddings: np.ndarray) -> np.ndarray:
    if embeddings.shape[0] == 0:
        return np.array([], dtype=int)

    # Skip clustering if fewer than 3 faces (HDBSCAN/DBSCAN need min 3 points)
    # Return -1 for all faces (unclustered) - they can still be named individually
    if embeddings.shape[0] < 3:
        return np.full(embeddings.shape[0], -1, dtype=int)

    # Normalize for cosine similarity
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-12
    emb = embeddings / norms

    # Use HDBSCAN with lower min_cluster_size for smaller sessions
    if hdbscan is not None:
        # min_cluster_size=3 works better for daycare sessions (fewer photos per child)
        clusterer = hdbscan.HDBSCAN(min_cluster_size=3, metric="euclidean")
        labels = clusterer.fit_predict(emb)
        return labels.astype(int)

    # Fallback DBSCAN
    db = DBSCAN(eps=0.35, min_samples=3, metric="euclidean")
    labels = db.fit_predict(emb)
    return labels.astype(int)


def write_cluster_ids(sb, face_ids: List[str], labels: np.ndarray, session_id: str) -> None:
    # Batch update cluster IDs
    updates_by_cluster: Dict[str, List[str]] = {}
    for face_id, label in zip(face_ids, labels.tolist()):
        if label < 0:
            continue
        cluster_id = f"cluster_{session_id}_{label}"
        if cluster_id not in updates_by_cluster:
            updates_by_cluster[cluster_id] = []
        updates_by_cluster[cluster_id].append(face_id)

    # Update in batches per cluster
    for cluster_id, ids in updates_by_cluster.items():
        sb.table("discovered_faces").update({"cluster_id": cluster_id}).in_("id", ids).execute()


def build_face_analyzer() -> FaceAnalysis:
    """Build InsightFace analyzer with optimized settings."""
    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=-1, det_size=(DET_SIZE, DET_SIZE))
    return app


def process_single_photo(
    analyzer: FaceAnalysis,
    photo: Dict[str, Any],
) -> Tuple[str, List[DetectedFace], Optional[str]]:
    """
    Process a single photo: download, detect faces, extract embeddings.
    Returns (photo_id, detected_faces, error_message).
    """
    photo_id = photo["id"]
    url = photo.get("thumbnail_url") or photo.get("original_url")

    if not url:
        return photo_id, [], "No URL"

    try:
        img = download_image(url)
        bgr = pil_to_np_bgr(img)
        found = analyzer.get(bgr)
    except Exception as e:
        return photo_id, [], str(e)

    detected: List[DetectedFace] = []
    for f in found:
        bbox = f.bbox.astype(float)  # [x0, y0, x1, y1]
        x0, y0, x1, y1 = bbox.tolist()
        w = max(0.0, x1 - x0)
        h = max(0.0, y1 - y0)
        emb = f.embedding.astype(np.float32)
        det_score = float(getattr(f, "det_score", 0.0))

        crop = crop_face(img, (x0, y0, w, h))
        crop_bytes = encode_webp(crop)
        detected.append(
            DetectedFace(
                photo_id=photo_id,
                bbox=(x0, y0, w, h),
                det_score=det_score,
                embedding=emb,
                crop_webp=crop_bytes,
            )
        )

    return photo_id, detected, None


def upload_crops_parallel(sb, session_id: str, faces: List[DetectedFace]) -> None:
    """Upload face crops in parallel using threads."""
    def upload_one(face: DetectedFace) -> None:
        try:
            face.crop_url = upload_crop(sb, session_id, face.crop_webp)
        except Exception:
            pass  # Skip failed uploads

    with ThreadPoolExecutor(max_workers=PHOTO_CONCURRENCY) as executor:
        list(executor.map(upload_one, faces))


def process_session(sb, job: Dict[str, Any]) -> None:
    job_id = job["id"]
    session_id = job["session_id"]

    photos = list_photos_for_session(sb, session_id)
    total = len(photos)

    update_job(
        sb,
        job_id,
        {"photos_total": total, "photos_done": 0, "faces_total": 0, "message": "Loading models...", "progress": 0.02},
    )

    # Build analyzer once (reused for all photos)
    analyzer = build_face_analyzer()

    all_face_ids: List[str] = []
    all_embeddings: List[np.ndarray] = []
    pending_faces: List[DetectedFace] = []
    faces_total = 0
    photos_done = 0
    last_progress_update = 0

    update_job(sb, job_id, {"message": f"Processing {total} photos...", "progress": 0.05})

    # Process photos sequentially (InsightFace is CPU-bound, parallelism doesn't help much)
    # But we batch DB operations for efficiency
    for idx, photo in enumerate(photos):
        photo_id, detected, error = process_single_photo(analyzer, photo)

        if error:
            # Log but continue
            pass

        pending_faces.extend(detected)
        photos_done = idx + 1

        # Batch upload crops and upsert every UPSERT_BATCH_SIZE photos
        # or when we have accumulated enough faces
        should_flush = (
            photos_done == total or  # Last batch
            len(pending_faces) >= UPSERT_BATCH_SIZE * 3 or  # Many faces accumulated
            (photos_done % UPSERT_BATCH_SIZE == 0 and pending_faces)  # Regular interval
        )

        if should_flush and pending_faces:
            # Upload crops in parallel
            upload_crops_parallel(sb, session_id, pending_faces)

            # Batch upsert to DB
            face_ids = upsert_discovered_faces(sb, session_id, pending_faces)

            # Track for clustering
            for i, face_id in enumerate(face_ids):
                if i < len(pending_faces):
                    all_face_ids.append(face_id)
                    all_embeddings.append(pending_faces[i].embedding)

            faces_total += len(face_ids)
            pending_faces = []

        # Update progress less frequently (every N photos)
        if photos_done - last_progress_update >= PROGRESS_UPDATE_INTERVAL or photos_done == total:
            progress = 0.05 + (0.75 * photos_done / max(1, total))
            update_job(
                sb,
                job_id,
                {
                    "photos_done": photos_done,
                    "faces_total": faces_total,
                    "message": f"Processed {photos_done}/{total} photos",
                    "progress": progress,
                },
            )
            last_progress_update = photos_done

    # Cluster all faces
    update_job(sb, job_id, {"message": "Clustering faces...", "progress": 0.85})
    if all_embeddings:
        emb_mat = np.stack(all_embeddings, axis=0)
        labels = cluster_embeddings(emb_mat)
        write_cluster_ids(sb, all_face_ids, labels, session_id)

    update_job(sb, job_id, {"status": "complete", "progress": 1.0, "message": "Complete"})


def main() -> None:
    sb = supabase()
    print(f"[face-worker] started (det_size={DET_SIZE}, concurrency={PHOTO_CONCURRENCY})")

    while True:
        job = fetch_one_job(sb)
        if not job:
            time.sleep(POLL_INTERVAL_SECONDS)
            continue

        job_id = job["id"]
        if not claim_job(sb, job_id):
            continue

        try:
            process_session(sb, job)
        except Exception as e:
            update_job(sb, job_id, {"status": "failed", "error": str(e), "message": "Failed"})


if __name__ == "__main__":
    main()
