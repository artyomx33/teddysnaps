-- Migration: Add retouched photos support to photos table
-- Allows uploading edited photos directly linked to families

-- Add family_id to link retouched photos directly to a family
ALTER TABLE photos ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES families(id) ON DELETE CASCADE;

-- Add flag to mark photos as retouched/uploaded (vs matched from sessions)
ALTER TABLE photos ADD COLUMN IF NOT EXISTS is_retouched boolean DEFAULT false;

-- Index for querying retouched photos by family efficiently
CREATE INDEX IF NOT EXISTS idx_photos_family_retouched ON photos(family_id) WHERE is_retouched = true;
