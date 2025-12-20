-- TeddySnaps Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- LOCATIONS (TeddyKids branches)
-- ============================================
create table if not exists locations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  address text,
  created_at timestamptz default now()
);

-- ============================================
-- FAMILIES
-- ============================================
create table if not exists families (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id),
  family_name text not null,
  email text,
  phone text,
  access_code text unique not null,
  created_at timestamptz default now()
);

create index if not exists idx_families_location on families(location_id);
create index if not exists idx_families_access_code on families(access_code);

-- ============================================
-- CHILDREN
-- ============================================
create table if not exists children (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid references families(id) on delete cascade,
  first_name text not null,
  date_of_birth date,
  face_descriptor jsonb,
  reference_photo_url text,
  is_enrolled boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_children_family on children(family_id);
create index if not exists idx_children_enrolled on children(is_enrolled) where is_enrolled = true;

-- ============================================
-- PHOTO SESSIONS
-- ============================================
create table if not exists photo_sessions (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id),
  name text not null,
  shoot_date date not null,
  status text default 'processing' check (status in ('processing', 'ready', 'archived')),
  total_photos int default 0,
  created_at timestamptz default now()
);

create index if not exists idx_sessions_location on photo_sessions(location_id);
create index if not exists idx_sessions_status on photo_sessions(status);

-- ============================================
-- PHOTOS
-- ============================================
create table if not exists photos (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references photo_sessions(id) on delete cascade,
  original_url text not null,
  thumbnail_url text,
  processed_url text,
  filename text,
  width int,
  height int,
  faces_detected int default 0,
  needs_review boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_photos_session on photos(session_id);
create index if not exists idx_photos_needs_review on photos(needs_review) where needs_review = true;

-- ============================================
-- PHOTO-CHILD MATCHES (many-to-many)
-- ============================================
create table if not exists photo_children (
  id uuid primary key default uuid_generate_v4(),
  photo_id uuid references photos(id) on delete cascade,
  child_id uuid references children(id) on delete cascade,
  confidence float,
  is_confirmed boolean default false,
  created_at timestamptz default now(),
  unique(photo_id, child_id)
);

create index if not exists idx_photo_children_photo on photo_children(photo_id);
create index if not exists idx_photo_children_child on photo_children(child_id);

-- ============================================
-- PRODUCTS (pricing configuration)
-- ============================================
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('digital', 'print', 'canvas', 'book')),
  size text,
  price decimal(10,2) not null,
  is_active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ============================================
-- ORDERS
-- ============================================
create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid references families(id),
  session_id uuid references photo_sessions(id),
  order_number text unique not null,
  status text default 'pending' check (status in ('pending', 'paid', 'processing', 'ready', 'delivered')),
  delivery_method text not null check (delivery_method in ('email', 'whatsapp', 'pickup', 'delivery')),
  delivery_address text,
  subtotal decimal(10,2) not null,
  discount decimal(10,2) default 0,
  total decimal(10,2) not null,
  payment_id text,
  payment_status text default 'pending' check (payment_status in ('pending', 'paid', 'failed')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_orders_family on orders(family_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_created on orders(created_at desc);

-- ============================================
-- ORDER ITEMS
-- ============================================
create table if not exists order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade,
  photo_id uuid references photos(id),
  product_id uuid references products(id),
  quantity int default 1,
  unit_price decimal(10,2) not null,
  total_price decimal(10,2) not null,
  created_at timestamptz default now()
);

create index if not exists idx_order_items_order on order_items(order_id);

-- ============================================
-- USERS (staff accounts)
-- ============================================
create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null check (role in ('admin', 'photographer', 'teacher')),
  location_id uuid references locations(id),
  created_at timestamptz default now()
);

create index if not exists idx_users_role on users(role);
create index if not exists idx_users_location on users(location_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table locations enable row level security;
alter table families enable row level security;
alter table children enable row level security;
alter table photo_sessions enable row level security;
alter table photos enable row level security;
alter table photo_children enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table users enable row level security;

-- Products are public read
create policy "Products are viewable by everyone"
  on products for select
  using (true);

-- Users can read their own profile
create policy "Users can view own profile"
  on users for select
  using (auth.uid() = id);

-- Staff can view families at their location
create policy "Staff can view families"
  on families for select
  using (
    exists (
      select 1 from users u
      where u.id = auth.uid()
      and (u.role in ('admin', 'photographer') or u.location_id = families.location_id)
    )
  );

-- Staff can view children
create policy "Staff can view children"
  on children for select
  using (
    exists (
      select 1 from users u
      join families f on f.id = children.family_id
      where u.id = auth.uid()
      and (u.role in ('admin', 'photographer') or u.location_id = f.location_id)
    )
  );

-- Staff can view sessions at their location
create policy "Staff can view sessions"
  on photo_sessions for select
  using (
    exists (
      select 1 from users u
      where u.id = auth.uid()
      and (u.role in ('admin', 'photographer') or u.location_id = photo_sessions.location_id)
    )
  );

-- Staff can view photos
create policy "Staff can view photos"
  on photos for select
  using (
    exists (
      select 1 from users u
      join photo_sessions ps on ps.id = photos.session_id
      where u.id = auth.uid()
      and (u.role in ('admin', 'photographer') or u.location_id = ps.location_id)
    )
  );

-- Admin/Photographer can manage data
create policy "Admin can manage locations"
  on locations for all
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy "Admin/Photographer can manage families"
  on families for all
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can manage children"
  on children for all
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can manage sessions"
  on photo_sessions for all
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can manage photos"
  on photos for all
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can manage photo_children"
  on photo_children for all
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Staff can view orders"
  on orders for select
  using (
    exists (select 1 from users u where u.id = auth.uid())
  );

create policy "Admin/Photographer can manage orders"
  on orders for all
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Staff can view order items"
  on order_items for select
  using (
    exists (select 1 from users u where u.id = auth.uid())
  );

-- ============================================
-- SEED DATA: Default products
-- ============================================
insert into products (id, name, type, size, price, sort_order) values
  ('11111111-1111-1111-1111-111111111111', 'Digital HD', 'digital', null, 2.50, 1),
  ('22222222-2222-2222-2222-222222222222', '10×15 Print', 'print', '10x15', 4.50, 2),
  ('33333333-3333-3333-3333-333333333333', '13×18 Print', 'print', '13x18', 6.00, 3),
  ('44444444-4444-4444-4444-444444444444', '20×30 Print', 'print', '20x30', 8.50, 4),
  ('55555555-5555-5555-5555-555555555555', 'Canvas 30×40', 'canvas', '30x40', 29.00, 5),
  ('66666666-6666-6666-6666-666666666666', 'Photo Book 20 pages', 'book', '20pages', 35.00, 6)
on conflict (id) do nothing;

-- ============================================
-- STORAGE BUCKETS (run separately in Supabase dashboard)
-- ============================================
-- Create these buckets in the Supabase Storage UI:
-- 1. photos-originals (private)
-- 2. photos-thumbnails (public)
-- 3. photos-processed (public)
-- 4. reference-photos (private)

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for orders
drop trigger if exists orders_updated_at on orders;
create trigger orders_updated_at
  before update on orders
  for each row
  execute function update_updated_at();

-- Function to generate order number
create or replace function generate_order_number()
returns trigger as $$
begin
  if new.order_number is null then
    new.order_number = 'TS-' || extract(year from now())::text || '-' ||
      lpad(floor(random() * 1000000)::text, 6, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists orders_generate_number on orders;
create trigger orders_generate_number
  before insert on orders
  for each row
  execute function generate_order_number();

-- Function to update session photo count
create or replace function update_session_photo_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update photo_sessions
    set total_photos = total_photos + 1
    where id = new.session_id;
  elsif tg_op = 'DELETE' then
    update photo_sessions
    set total_photos = total_photos - 1
    where id = old.session_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql;

drop trigger if exists photos_count_trigger on photos;
create trigger photos_count_trigger
  after insert or delete on photos
  for each row
  execute function update_session_photo_count();
