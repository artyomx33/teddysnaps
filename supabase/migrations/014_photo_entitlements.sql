-- Track exactly which photos a family purchased (per-photo or bundle expansion).
-- Source of truth for retouch/delivery workflows.

create table if not exists photo_entitlements (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  session_id uuid not null references photo_sessions(id) on delete cascade,
  photo_id uuid not null references photos(id) on delete cascade,
  product_id uuid not null references products(id),
  source text not null check (source in ('per_photo', 'bundle')),
  created_at timestamptz default now(),
  unique(family_id, photo_id)
);

create index if not exists idx_photo_entitlements_family on photo_entitlements(family_id);
create index if not exists idx_photo_entitlements_session on photo_entitlements(session_id);
create index if not exists idx_photo_entitlements_order on photo_entitlements(order_id);
create index if not exists idx_photo_entitlements_photo on photo_entitlements(photo_id);

-- Keep consistent with permissive daycare setup
alter table photo_entitlements disable row level security;

-- Track exactly which photos a family purchased (per-photo or bundle expansion).
-- This becomes the source of truth for retouch/delivery workflows.

create table if not exists photo_entitlements (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  session_id uuid not null references photo_sessions(id) on delete cascade,
  photo_id uuid not null references photos(id) on delete cascade,
  product_id uuid not null references products(id),
  source text not null check (source in ('per_photo', 'bundle')),
  created_at timestamptz default now(),
  unique(family_id, photo_id)
);

create index if not exists idx_photo_entitlements_family on photo_entitlements(family_id);
create index if not exists idx_photo_entitlements_session on photo_entitlements(session_id);
create index if not exists idx_photo_entitlements_order on photo_entitlements(order_id);
create index if not exists idx_photo_entitlements_photo on photo_entitlements(photo_id);

-- Keep consistent with permissive daycare setup
alter table photo_entitlements disable row level security;


