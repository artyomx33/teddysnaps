-- Fix all RLS policies for TeddySnaps MVP
-- This allows public/anonymous access for the MVP (no auth required)

-- ============================================
-- DROP ALL EXISTING POLICIES
-- ============================================

-- Users
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admin can read all users" ON users;
DROP POLICY IF EXISTS "Admin can update all users" ON users;
DROP POLICY IF EXISTS "Admin can delete users" ON users;

-- Locations
DROP POLICY IF EXISTS "Public can view locations" ON locations;
DROP POLICY IF EXISTS "Admin can insert locations" ON locations;
DROP POLICY IF EXISTS "Admin can update locations" ON locations;
DROP POLICY IF EXISTS "Admin can delete locations" ON locations;

-- Families
DROP POLICY IF EXISTS "Admin/Photographer can select families" ON families;
DROP POLICY IF EXISTS "Admin/Photographer can insert families" ON families;
DROP POLICY IF EXISTS "Admin/Photographer can update families" ON families;
DROP POLICY IF EXISTS "Admin/Photographer can delete families" ON families;
DROP POLICY IF EXISTS "Public can view family by access_code" ON families;

-- Children
DROP POLICY IF EXISTS "Admin/Photographer can select children" ON children;
DROP POLICY IF EXISTS "Admin/Photographer can insert children" ON children;
DROP POLICY IF EXISTS "Admin/Photographer can update children" ON children;
DROP POLICY IF EXISTS "Admin/Photographer can delete children" ON children;
DROP POLICY IF EXISTS "Public can view children" ON children;

-- Photo Sessions
DROP POLICY IF EXISTS "Admin/Photographer can select sessions" ON photo_sessions;
DROP POLICY IF EXISTS "Admin/Photographer can insert sessions" ON photo_sessions;
DROP POLICY IF EXISTS "Admin/Photographer can update sessions" ON photo_sessions;
DROP POLICY IF EXISTS "Admin/Photographer can delete sessions" ON photo_sessions;
DROP POLICY IF EXISTS "Public can view sessions" ON photo_sessions;

-- Photos
DROP POLICY IF EXISTS "Admin/Photographer can select photos" ON photos;
DROP POLICY IF EXISTS "Admin/Photographer can insert photos" ON photos;
DROP POLICY IF EXISTS "Admin/Photographer can update photos" ON photos;
DROP POLICY IF EXISTS "Admin/Photographer can delete photos" ON photos;
DROP POLICY IF EXISTS "Public can view photos" ON photos;

-- Photo Children
DROP POLICY IF EXISTS "Admin/Photographer can select photo_children" ON photo_children;
DROP POLICY IF EXISTS "Admin/Photographer can insert photo_children" ON photo_children;
DROP POLICY IF EXISTS "Admin/Photographer can update photo_children" ON photo_children;
DROP POLICY IF EXISTS "Admin/Photographer can delete photo_children" ON photo_children;
DROP POLICY IF EXISTS "Public can view photo_children" ON photo_children;

-- Orders
DROP POLICY IF EXISTS "Staff can view orders" ON orders;
DROP POLICY IF EXISTS "Admin/Photographer can insert orders" ON orders;
DROP POLICY IF EXISTS "Admin/Photographer can update orders" ON orders;
DROP POLICY IF EXISTS "Admin/Photographer can delete orders" ON orders;
DROP POLICY IF EXISTS "Public can insert orders" ON orders;
DROP POLICY IF EXISTS "Public can view own orders" ON orders;

-- Order Items
DROP POLICY IF EXISTS "Staff can view order_items" ON order_items;
DROP POLICY IF EXISTS "Admin/Photographer can insert order_items" ON order_items;
DROP POLICY IF EXISTS "Admin/Photographer can update order_items" ON order_items;
DROP POLICY IF EXISTS "Admin/Photographer can delete order_items" ON order_items;
DROP POLICY IF EXISTS "Public can insert order_items" ON order_items;

-- Products
DROP POLICY IF EXISTS "Public can view products" ON products;

-- ============================================
-- CREATE SIMPLE MVP POLICIES (Full Public Access)
-- ============================================

-- For MVP, we allow all operations without auth
-- This should be tightened before production

-- Locations: Full public access
CREATE POLICY "locations_all" ON locations FOR ALL USING (true) WITH CHECK (true);

-- Families: Full public access
CREATE POLICY "families_all" ON families FOR ALL USING (true) WITH CHECK (true);

-- Children: Full public access
CREATE POLICY "children_all" ON children FOR ALL USING (true) WITH CHECK (true);

-- Photo Sessions: Full public access
CREATE POLICY "sessions_all" ON photo_sessions FOR ALL USING (true) WITH CHECK (true);

-- Photos: Full public access
CREATE POLICY "photos_all" ON photos FOR ALL USING (true) WITH CHECK (true);

-- Photo Children: Full public access
CREATE POLICY "photo_children_all" ON photo_children FOR ALL USING (true) WITH CHECK (true);

-- Orders: Full public access
CREATE POLICY "orders_all" ON orders FOR ALL USING (true) WITH CHECK (true);

-- Order Items: Full public access
CREATE POLICY "order_items_all" ON order_items FOR ALL USING (true) WITH CHECK (true);

-- Products: Full public access
CREATE POLICY "products_all" ON products FOR ALL USING (true) WITH CHECK (true);

-- Users: Full public access (for MVP)
CREATE POLICY "users_all" ON users FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- STORAGE POLICIES
-- ============================================

-- Allow public uploads to photos-originals bucket
DROP POLICY IF EXISTS "Allow uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
DROP POLICY IF EXISTS "photos_originals_insert" ON storage.objects;
DROP POLICY IF EXISTS "photos_originals_select" ON storage.objects;

-- Insert policy for photos-originals
CREATE POLICY "storage_insert_all" ON storage.objects
FOR INSERT WITH CHECK (bucket_id IN ('photos-originals', 'photos-thumbnails', 'reference-photos'));

-- Select policy for all photo buckets
CREATE POLICY "storage_select_all" ON storage.objects
FOR SELECT USING (bucket_id IN ('photos-originals', 'photos-thumbnails', 'reference-photos'));

-- Update policy
CREATE POLICY "storage_update_all" ON storage.objects
FOR UPDATE USING (bucket_id IN ('photos-originals', 'photos-thumbnails', 'reference-photos'));

-- Delete policy
CREATE POLICY "storage_delete_all" ON storage.objects
FOR DELETE USING (bucket_id IN ('photos-originals', 'photos-thumbnails', 'reference-photos'));
