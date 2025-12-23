# Face Worker (InsightFace + ONNXRuntime)

This worker processes a `photo_sessions` session in the background:
- downloads photos
- detects faces and computes embeddings (InsightFace)
- uploads face crops to Supabase Storage
- upserts `discovered_faces`
- clusters embeddings and writes `cluster_id`
- updates `face_jobs` progress/status

## Environment

Required:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:
- `SUPABASE_BUCKET` (default: `photos-originals`)
- `POLL_INTERVAL_SECONDS` (default: `2`)

## Install

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
python worker.py
```

## Notes
- InsightFace may download model weights on first run. In Docker, bake them into the image or allow runtime download.
- Crops are uploaded to `faces/{sessionId}/{faceId}.webp` in the configured bucket.


