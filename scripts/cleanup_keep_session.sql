-- TeddySnaps cleanup: delete ALL uploads + face data EXCEPT one session (keep by name)
--
-- ⚠️ DESTRUCTIVE: This deletes photo sessions, photos, discovered faces, matches, face jobs,
-- and any orders/items linked to deleted sessions/photos. Storage objects in bucket
-- `photos-originals` for deleted sessions are also removed.
--
-- How to use:
-- 1) Open Supabase → SQL Editor
-- 2) Paste this whole file and run
-- 3) Change KEEP_SESSION_NAME below if needed
--
-- Notes:
-- - If multiple sessions share the same name, the most recently created is kept.
-- - We keep ALL non-upload data (families/children/locations/users/products) intact.

do $$
declare
  keep_session_name text := 'final big test';
  keep_session_id uuid;
  delete_session_ids text[];
begin
  -- Find the session to keep
  select ps.id
    into keep_session_id
  from photo_sessions ps
  where ps.name = keep_session_name
  order by ps.created_at desc
  limit 1;

  if keep_session_id is null then
    raise exception 'Cleanup aborted: no photo_sessions found with name = %', keep_session_name;
  end if;

  raise notice 'Keeping session % (%)', keep_session_name, keep_session_id;

  -- Snapshot which session IDs we will delete (needed later for storage cleanup)
  select array_agg(ps.id::text)
    into delete_session_ids
  from photo_sessions ps
  where ps.id <> keep_session_id;

  if delete_session_ids is null or array_length(delete_session_ids, 1) is null then
    raise notice 'Nothing to delete (only one session exists).';
    return;
  end if;

  -- Delete dependent rows first (orders may block session deletes)
  delete from order_items
  where order_id in (
    select o.id from orders o where o.session_id <> keep_session_id
  )
  or photo_id in (
    select p.id from photos p where p.session_id <> keep_session_id
  );

  delete from orders
  where session_id <> keep_session_id;

  -- Face pipeline tables
  delete from face_jobs
  where session_id <> keep_session_id;

  delete from discovered_faces
  where session_id <> keep_session_id;

  -- Matches for photos being deleted
  delete from photo_children
  where photo_id in (
    select p.id from photos p where p.session_id <> keep_session_id
  );

  -- Photos + sessions
  delete from photos
  where session_id <> keep_session_id;

  delete from photo_sessions
  where id <> keep_session_id;

  -- Recompute total_photos for the kept session
  update photo_sessions
  set total_photos = (
    select count(*) from photos p where p.session_id = keep_session_id
  )
  where id = keep_session_id;

  -- Storage cleanup (best-effort): remove objects for deleted sessions in bucket `photos-originals`
  -- Uploaded originals:   {sessionId}/{fileId}-{filename}
  -- Face crops:           faces/{sessionId}/{faceId}.webp
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage'
      and table_name = 'objects'
  ) then
    delete from storage.objects so
    where so.bucket_id = 'photos-originals'
      and (
        split_part(so.name, '/', 1) = any(delete_session_ids)
        or (
          split_part(so.name, '/', 1) = 'faces'
          and split_part(so.name, '/', 2) = any(delete_session_ids)
        )
      );
  end if;

  raise notice 'Cleanup complete. Kept session id=%', keep_session_id;
end $$;


