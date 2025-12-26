-- Migration: Disable RLS everywhere (no blockers) + align products schema
-- This is intentionally permissive for the daycare use-case.

do $$
declare
  t text;
begin
  -- Disable RLS on all tables used by the app. Ignore if a table doesn't exist.
  foreach t in array array[
    'locations',
    'families',
    'children',
    'photo_sessions',
    'photos',
    'photo_children',
    'products',
    'orders',
    'order_items',
    'users',
    'discovered_faces',
    'face_jobs'
  ]
  loop
    begin
      execute format('alter table %I disable row level security;', t);
    exception
      when undefined_table then
        -- ok
        null;
    end;
  end loop;
end $$;

-- Fix: code expects products.description, but schema may not have it yet.
alter table products
  add column if not exists description text;



