-- Add parent "heart"/favourite support (persisted likes)

create table if not exists photo_likes (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid not null references families(id) on delete cascade,
  photo_id uuid not null references photos(id) on delete cascade,
  created_at timestamptz default now(),
  unique(family_id, photo_id)
);

create index if not exists idx_photo_likes_photo on photo_likes(photo_id);
create index if not exists idx_photo_likes_family on photo_likes(family_id);

-- Keep consistent with permissive daycare setup
alter table photo_likes disable row level security;


