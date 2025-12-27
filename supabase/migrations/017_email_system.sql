-- Migration: Add email system fields to families table
-- Enables bulk email functionality with hot leads filter and email history tracking

-- Track when families last accessed the gallery (for "hot leads" filter)
ALTER TABLE families ADD COLUMN IF NOT EXISTS last_gallery_access timestamptz;

-- Track sent emails directly on family (JSONB array, no extra table)
-- Example: [{ "type": "reminder", "sent_at": "2024-12-27T10:00:00Z", "status": "sent" }]
ALTER TABLE families ADD COLUMN IF NOT EXISTS sent_emails jsonb DEFAULT '[]';

-- Index for hot leads queries (families active in last N days)
CREATE INDEX IF NOT EXISTS idx_families_last_gallery_access ON families(last_gallery_access DESC NULLS LAST);
