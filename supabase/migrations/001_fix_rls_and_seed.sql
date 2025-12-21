-- TeddySnaps RLS Fix Migration
-- This migration fixes INSERT policies and adds development helpers

-- ============================================
-- DROP EXISTING POLICIES (to recreate properly)
-- ============================================
drop policy if exists "Admin can manage locations" on locations;
drop policy if exists "Admin/Photographer can manage families" on families;
drop policy if exists "Admin/Photographer can manage children" on children;
drop policy if exists "Admin/Photographer can manage sessions" on photo_sessions;
drop policy if exists "Admin/Photographer can manage photos" on photos;
drop policy if exists "Admin/Photographer can manage photo_children" on photo_children;
drop policy if exists "Admin/Photographer can manage orders" on orders;
drop policy if exists "Staff can view orders" on orders;
drop policy if exists "Staff can view order items" on order_items;

-- ============================================
-- RECREATE POLICIES WITH PROPER WITH CHECK
-- ============================================

-- Locations: Admin full access
create policy "Admin can select locations"
  on locations for select
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy "Admin can insert locations"
  on locations for insert
  with check (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy "Admin can update locations"
  on locations for update
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  )
  with check (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy "Admin can delete locations"
  on locations for delete
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  );

-- Families: Admin/Photographer full access
create policy "Admin/Photographer can select families"
  on families for select
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can insert families"
  on families for insert
  with check (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can update families"
  on families for update
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  )
  with check (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can delete families"
  on families for delete
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

-- Children: Admin/Photographer full access
create policy "Admin/Photographer can select children"
  on children for select
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can insert children"
  on children for insert
  with check (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can update children"
  on children for update
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  )
  with check (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can delete children"
  on children for delete
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

-- Photo Sessions: Admin/Photographer full access
create policy "Admin/Photographer can select sessions"
  on photo_sessions for select
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can insert sessions"
  on photo_sessions for insert
  with check (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can update sessions"
  on photo_sessions for update
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  )
  with check (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can delete sessions"
  on photo_sessions for delete
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

-- Photos: Admin/Photographer full access
create policy "Admin/Photographer can select photos"
  on photos for select
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can insert photos"
  on photos for insert
  with check (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can update photos"
  on photos for update
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  )
  with check (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can delete photos"
  on photos for delete
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

-- Photo Children: Admin/Photographer full access
create policy "Admin/Photographer can select photo_children"
  on photo_children for select
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can insert photo_children"
  on photo_children for insert
  with check (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can update photo_children"
  on photo_children for update
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  )
  with check (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can delete photo_children"
  on photo_children for delete
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

-- Orders: Staff can view, Admin/Photographer can manage
create policy "Staff can view orders"
  on orders for select
  using (
    exists (select 1 from users u where u.id = auth.uid())
  );

create policy "Admin/Photographer can insert orders"
  on orders for insert
  with check (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can update orders"
  on orders for update
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  )
  with check (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can delete orders"
  on orders for delete
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

-- Order Items: Staff can view, Admin/Photographer can manage
create policy "Staff can view order_items"
  on order_items for select
  using (
    exists (select 1 from users u where u.id = auth.uid())
  );

create policy "Admin/Photographer can insert order_items"
  on order_items for insert
  with check (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can update order_items"
  on order_items for update
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  )
  with check (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

create policy "Admin/Photographer can delete order_items"
  on order_items for delete
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('admin', 'photographer'))
  );

-- ============================================
-- PUBLIC ACCESS POLICIES FOR PARENT GALLERY
-- ============================================

-- Families: Public can access by access_code (for gallery links)
create policy "Public can view family by access_code"
  on families for select
  using (true);  -- Access controlled at application level via access_code

-- Photos: Public can view photos (for gallery)
create policy "Public can view photos"
  on photos for select
  using (true);  -- Session access controlled at application level

-- Photo Sessions: Public can view sessions (for gallery)
create policy "Public can view sessions"
  on photo_sessions for select
  using (true);

-- Photo Children: Public can view (for filtering by child in gallery)
create policy "Public can view photo_children"
  on photo_children for select
  using (true);

-- Children: Public can view (for gallery filtering)
create policy "Public can view children"
  on children for select
  using (true);

-- Orders: Public can create and view their own orders
create policy "Public can insert orders"
  on orders for insert
  with check (true);  -- Family ID verified at application level

create policy "Public can view own orders"
  on orders for select
  using (true);  -- Order access controlled by order ID

-- Order Items: Public can create with their orders
create policy "Public can insert order_items"
  on order_items for insert
  with check (true);

-- ============================================
-- USER MANAGEMENT POLICIES
-- ============================================

-- Users: Allow users to create their own record after signup
create policy "Users can insert own profile"
  on users for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Admin can manage all users
create policy "Admin can manage users"
  on users for all
  using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  )
  with check (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  );

-- ============================================
-- SEED DATA: Test location and family
-- ============================================
insert into locations (id, name, slug, address)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TeddyKids Centrum', 'centrum', 'Centrum 123, Amsterdam')
on conflict (id) do nothing;

insert into families (id, location_id, family_name, email, access_code)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'De Vries', 'devries@example.com', 'TEDDY123')
on conflict (id) do nothing;

insert into children (id, family_id, first_name, is_enrolled)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Emma', true),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Lucas', true)
on conflict (id) do nothing;

-- Create a test photo session
insert into photo_sessions (id, location_id, name, shoot_date, status, total_photos)
values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Kerst Fotoshoot 2024', '2024-12-15', 'ready', 0)
on conflict (id) do nothing;
