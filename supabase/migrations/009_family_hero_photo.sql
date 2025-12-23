-- Add hero_photo_id to families table for family hero/display images
ALTER TABLE families
ADD COLUMN IF NOT EXISTS hero_photo_id uuid REFERENCES photos(id) ON DELETE SET NULL;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_families_hero_photo_id ON families(hero_photo_id);

COMMENT ON COLUMN families.hero_photo_id IS 'Optional hero photo for the family, selected by admin from matched photos';
