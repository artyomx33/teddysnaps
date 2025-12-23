-- Retouch workflow tasks per purchased photo (who did what + status).

create table if not exists retouch_tasks (
  id uuid primary key default uuid_generate_v4(),
  entitlement_id uuid references photo_entitlements(id) on delete set null,
  order_id uuid not null references orders(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  session_id uuid not null references photo_sessions(id) on delete cascade,
  photo_id uuid not null references photos(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'assigned', 'editing', 'done', 'delivered')),
  assigned_to uuid references users(id),
  retouched_url text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  assigned_at timestamptz,
  done_at timestamptz,
  delivered_at timestamptz,
  unique(family_id, photo_id)
);

create index if not exists idx_retouch_tasks_family on retouch_tasks(family_id);
create index if not exists idx_retouch_tasks_session on retouch_tasks(session_id);
create index if not exists idx_retouch_tasks_status on retouch_tasks(status);
create index if not exists idx_retouch_tasks_assigned_to on retouch_tasks(assigned_to);

-- updated_at trigger (reuse existing function if present)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'update_updated_at') then
    drop trigger if exists retouch_tasks_updated_at on retouch_tasks;
    create trigger retouch_tasks_updated_at
      before update on retouch_tasks
      for each row
      execute function update_updated_at();
  end if;
end $$;

-- Keep consistent with permissive daycare setup
alter table retouch_tasks disable row level security;

-- Retouch workflow tasks per purchased photo (who did what + status).

create table if not exists retouch_tasks (
  id uuid primary key default uuid_generate_v4(),
  entitlement_id uuid references photo_entitlements(id) on delete set null,
  order_id uuid not null references orders(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  session_id uuid not null references photo_sessions(id) on delete cascade,
  photo_id uuid not null references photos(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'assigned', 'editing', 'done', 'delivered')),
  assigned_to uuid references users(id),
  retouched_url text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  assigned_at timestamptz,
  done_at timestamptz,
  delivered_at timestamptz,
  unique(family_id, photo_id)
);

create index if not exists idx_retouch_tasks_family on retouch_tasks(family_id);
create index if not exists idx_retouch_tasks_session on retouch_tasks(session_id);
create index if not exists idx_retouch_tasks_status on retouch_tasks(status);
create index if not exists idx_retouch_tasks_assigned_to on retouch_tasks(assigned_to);

-- updated_at trigger (reuse existing function if present)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'update_updated_at') then
    drop trigger if exists retouch_tasks_updated_at on retouch_tasks;
    create trigger retouch_tasks_updated_at
      before update on retouch_tasks
      for each row
      execute function update_updated_at();
  end if;
end $$;

-- Keep consistent with permissive daycare setup
alter table retouch_tasks disable row level security;


