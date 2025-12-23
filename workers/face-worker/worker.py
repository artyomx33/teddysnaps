import io
import os
import time
import uuid
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


SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_BUCKET = os.environ.get("SUPABASE_BUCKET", "photos-originals")
POLL_INTERVAL_SECONDS = float(os.environ.get("POLL_INTERVAL_SECONDS", "2"))

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


def supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def fetch_one_job(sb) -> Optional[Dict[str, Any]]:
    # Prefer queued jobs, oldest first
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
    # Best-effort claim: update to running if still queued
    res = (
        sb.table("face_jobs")
        .update({"status": "running", "message": "Starting...", "progress": 0.01})
        .eq("id", job_id)
        .eq("status", "queued")
        .execute()
    )
    return bool(res.data)


def list_photos_for_session(sb, session_id: str) -> List[Dict[str, Any]]:
    res = (
        sb.table("photos")
        .select("id, original_url, thumbnail_url")
        .eq("session_id", session_id)
        .order("created_at", desc=False)
        .execute()
    )
    return res.data or []


def download_image(url: str, timeout: int = 30) -> Image.Image:
    r = requests.get(url, timeout=timeout)
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
        {"content-type": "image/webp", "upsert": True},
    )
    public = sb.storage.from_(SUPABASE_BUCKET).get_public_url(path)
    # supabase-py returns string for get_public_url
    return public


def upsert_discovered_faces(sb, session_id: str, faces: List[DetectedFace]) -> List[str]:
    payload = []
    for f in faces:
        x, y, w, h = f.bbox
        if not f.crop_url:
            # Skip faces without uploaded crops (should be rare)
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

    res = (
        sb.table("discovered_faces")
        .upsert(
            payload,
            on_conflict="photo_id,bbox_x,bbox_y,bbox_width,bbox_height",
        )
        .select("id")
        .execute()
    )
    return [row["id"] for row in (res.data or [])]


def cluster_embeddings(embeddings: np.ndarray) -> np.ndarray:
    # embeddings: (N, D)
    if embeddings.shape[0] == 0:
        return np.array([], dtype=int)

    # Normalize for cosine-ish behavior
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-12
    emb = embeddings / norms

    # Prefer HDBSCAN (handles unknown K + noise)
    if hdbscan is not None:
        clusterer = hdbscan.HDBSCAN(min_cluster_size=5, metric="euclidean")
        labels = clusterer.fit_predict(emb)
        return labels.astype(int)

    # Fallback DBSCAN
    db = DBSCAN(eps=0.35, min_samples=5, metric="euclidean")
    labels = db.fit_predict(emb)
    return labels.astype(int)


def write_cluster_ids(sb, face_ids: List[str], labels: np.ndarray, session_id: str) -> None:
    # label -1 => noise (keep cluster_id NULL)
    # cluster_id is text (e.g., cluster_{sessionId}_{k})
    for face_id, label in zip(face_ids, labels.tolist()):
        if label < 0:
            continue
        cluster_id = f"cluster_{session_id}_{label}"
        sb.table("discovered_faces").update({"cluster_id": cluster_id}).eq("id", face_id).execute()


def build_face_analyzer() -> FaceAnalysis:
    # CPU default. For GPU: set providers accordingly in production.
    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=-1, det_size=(640, 640))
    return app


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

    analyzer = build_face_analyzer()

    all_face_ids: List[str] = []
    all_embeddings: List[np.ndarray] = []

    faces_total = 0
    for idx, p in enumerate(photos):
        photo_id = p["id"]
        url = p.get("thumbnail_url") or p.get("original_url")
        if not url:
            continue

        try:
            img = download_image(url)
            bgr = pil_to_np_bgr(img)
            found = analyzer.get(bgr)
        except Exception as e:
            update_job(
                sb,
                job_id,
                {"message": f"Failed photo {idx+1}/{total}: {photo_id}", "error": str(e)},
            )
            continue

        detected: List[DetectedFace] = []
        for f in found:
            bbox = f.bbox.astype(float)  # [x0,y0,x1,y1]
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

        # Upload crops & upsert discovered_faces
        for d in detected:
            try:
                d.crop_url = upload_crop(sb, session_id, d.crop_webp)
            except Exception as e:
                update_job(sb, job_id, {"message": f"Crop upload failed: {photo_id}", "error": str(e)})

        face_ids = upsert_discovered_faces(sb, session_id, detected)

        # Keep embeddings for clustering in the same order as face_ids
        # Note: upsert may return fewer IDs if conflicts happen; for MVP that's acceptable.
        for i, face_id in enumerate(face_ids):
            all_face_ids.append(face_id)
            all_embeddings.append(detected[i].embedding)

        faces_total += len(face_ids)

        update_job(
            sb,
            job_id,
            {
                "photos_done": idx + 1,
                "faces_total": faces_total,
                "message": f"Processed photo {idx+1}/{total}",
                "progress": 0.05 + (0.75 * (idx + 1) / max(1, total)),
            },
        )

    # Cluster
    update_job(sb, job_id, {"message": "Clustering faces...", "progress": 0.85})
    if all_embeddings:
        emb_mat = np.stack(all_embeddings, axis=0)
        labels = cluster_embeddings(emb_mat)
        write_cluster_ids(sb, all_face_ids, labels, session_id)

    update_job(sb, job_id, {"status": "complete", "progress": 1.0, "message": "Complete"})


def main() -> None:
    sb = supabase()
    print("[face-worker] started")

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


