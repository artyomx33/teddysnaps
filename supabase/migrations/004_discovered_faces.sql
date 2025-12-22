-- Migration: Discovered Faces
-- Stores detected faces before they're named/matched

-- Table: discovered_faces
-- Stores face descriptors and crop images from photos
CREATE TABLE discovered_faces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES photo_sessions(id) ON DELETE CASCADE,
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,

  -- Face data
  face_descriptor JSONB NOT NULL, -- 128-dimensional float array
  crop_url TEXT NOT NULL, -- URL to cropped face image
  detection_score FLOAT NOT NULL DEFAULT 0.0, -- face-api.js detection confidence

  -- Bounding box (for deduplication)
  bbox_x FLOAT NOT NULL,
  bbox_y FLOAT NOT NULL,
  bbox_width FLOAT NOT NULL,
  bbox_height FLOAT NOT NULL,

  -- Clustering/naming
  cluster_id TEXT, -- Simple string ID (e.g., cluster_1703256000_0)
  child_id UUID REFERENCES children(id) ON DELETE SET NULL, -- NULL until named
  confidence FLOAT, -- Confidence of the name assignment

  -- Status
  is_named BOOLEAN DEFAULT FALSE,
  is_skipped BOOLEAN DEFAULT FALSE, -- For "Not a face" option

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint to prevent duplicate faces (same bbox in same photo)
CREATE UNIQUE INDEX idx_discovered_faces_unique
ON discovered_faces(photo_id, bbox_x, bbox_y, bbox_width, bbox_height);

-- Indexes for performance
CREATE INDEX idx_discovered_faces_session ON discovered_faces(session_id);
CREATE INDEX idx_discovered_faces_photo ON discovered_faces(photo_id);
CREATE INDEX idx_discovered_faces_cluster ON discovered_faces(cluster_id) WHERE cluster_id IS NOT NULL;
CREATE INDEX idx_discovered_faces_child ON discovered_faces(child_id) WHERE child_id IS NOT NULL;
CREATE INDEX idx_discovered_faces_unnamed ON discovered_faces(session_id) WHERE is_named = FALSE AND is_skipped = FALSE;

-- RLS policies
ALTER TABLE discovered_faces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage discovered faces"
ON discovered_faces FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'photographer')
  )
);

CREATE POLICY "Public can view discovered faces"
ON discovered_faces FOR SELECT
USING (true);
