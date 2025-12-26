-- Add done_at timestamp to families table
-- Status is computed: family is "open" if has orders newer than done_at
ALTER TABLE families ADD COLUMN done_at timestamptz;
