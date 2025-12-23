-- Migration: Face Jobs Queue
-- Adds a simple DB-backed queue for server-side face processing workers.

create table if not exists face_jobs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references photo_sessions(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'failed', 'complete')),
  progress float not null default 0.0 check (progress >= 0.0 and progress <= 1.0),
  message text,
  photos_total int,
  photos_done int,
  faces_total int,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_face_jobs_session on face_jobs(session_id);
create index if not exists idx_face_jobs_status on face_jobs(status);

-- one active job per session (helps prevent accidental double-enqueue)
create unique index if not exists idx_face_jobs_session_active
on face_jobs(session_id)
where status in ('queued', 'running');

-- RLS: MVP open policy (consistent with 005_simplify_rls.sql)
alter table face_jobs enable row level security;
drop policy if exists "face_jobs_all" on face_jobs;
create policy "face_jobs_all" on face_jobs for all using (true) with check (true);

-- updated_at trigger
-- Ensure helper function exists (schema.sql defines it, but migrations must be self-contained).
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists face_jobs_updated_at on face_jobs;
create trigger face_jobs_updated_at
  before update on face_jobs
  for each row
  execute function update_updated_at();


