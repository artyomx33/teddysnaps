-- Migration: Merge duplicate children by first_name
-- This fixes an issue where the face matching process created separate children/families
-- for the same child when they appeared in different photos

-- Step 1: Create a temp table with the "keeper" child for each name
-- We keep the first child (by id) for each unique first_name
CREATE TEMP TABLE child_keepers AS
SELECT DISTINCT ON (first_name)
  id as keeper_id,
  first_name,
  family_id as keeper_family_id
FROM children
ORDER BY first_name, id;

-- Step 2: Create a mapping of duplicate children to their keeper
CREATE TEMP TABLE child_mapping AS
SELECT
  c.id as duplicate_id,
  c.family_id as duplicate_family_id,
  k.keeper_id,
  k.keeper_family_id,
  c.first_name
FROM children c
JOIN child_keepers k ON c.first_name = k.first_name
WHERE c.id != k.keeper_id;

-- Show what we're about to merge (for logging)
DO $$
DECLARE
  dup_count INTEGER;
  affected_names TEXT;
BEGIN
  SELECT COUNT(*), string_agg(DISTINCT first_name, ', ' ORDER BY first_name)
  INTO dup_count, affected_names
  FROM child_mapping;

  RAISE NOTICE 'Merging % duplicate children for names: %', dup_count, affected_names;
END $$;

-- Step 3: For photo_children - delete all records for duplicate children
-- then insert new records for keeper children (deduplicated)
-- This avoids the unique constraint issue

-- First, save which photos should have which keepers
CREATE TEMP TABLE photo_keeper_map AS
SELECT DISTINCT pc.photo_id, cm.keeper_id
FROM photo_children pc
JOIN child_mapping cm ON pc.child_id = cm.duplicate_id
UNION
SELECT DISTINCT pc.photo_id, pc.child_id as keeper_id
FROM photo_children pc
WHERE pc.child_id IN (SELECT keeper_id FROM child_keepers);

-- Delete all photo_children for duplicate children
DELETE FROM photo_children pc
WHERE pc.child_id IN (SELECT duplicate_id FROM child_mapping);

-- Insert photo_children for keepers (only if not already there)
INSERT INTO photo_children (photo_id, child_id)
SELECT pkm.photo_id, pkm.keeper_id
FROM photo_keeper_map pkm
WHERE NOT EXISTS (
  SELECT 1 FROM photo_children pc
  WHERE pc.photo_id = pkm.photo_id AND pc.child_id = pkm.keeper_id
)
ON CONFLICT (photo_id, child_id) DO NOTHING;

-- Step 4: Same approach for discovered_faces
-- First, save which faces should have which keepers
CREATE TEMP TABLE face_keeper_map AS
SELECT DISTINCT df.id as face_id, cm.keeper_id
FROM discovered_faces df
JOIN child_mapping cm ON df.child_id = cm.duplicate_id;

-- Update discovered_faces for duplicate children to keepers
UPDATE discovered_faces df
SET child_id = fkm.keeper_id
FROM face_keeper_map fkm
WHERE df.id = fkm.face_id;

-- Step 5: Collect families that will become empty
CREATE TEMP TABLE families_to_delete AS
SELECT DISTINCT duplicate_family_id as family_id
FROM child_mapping
WHERE duplicate_family_id NOT IN (
  -- Exclude families that have other children not being deleted
  SELECT family_id FROM children
  WHERE id NOT IN (SELECT duplicate_id FROM child_mapping)
);

-- Step 6: Delete duplicate children
DELETE FROM children
WHERE id IN (SELECT duplicate_id FROM child_mapping);

-- Step 7: Delete empty families (families that had only duplicate children)
DELETE FROM families
WHERE id IN (SELECT family_id FROM families_to_delete);

-- Cleanup temp tables
DROP TABLE child_mapping;
DROP TABLE child_keepers;
DROP TABLE families_to_delete;
DROP TABLE photo_keeper_map;
DROP TABLE face_keeper_map;

-- Report final state
DO $$
DECLARE
  child_count INTEGER;
  family_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO child_count FROM children;
  SELECT COUNT(*) INTO family_count FROM families;

  RAISE NOTICE 'Migration complete. Remaining: % children, % families', child_count, family_count;
END $$;
