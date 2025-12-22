-- Migration: Simplify RLS for MVP
-- Remove auth.uid() requirements from discovered_faces
-- All admin operations go through server actions with proper validation
-- Only keep meaningful RLS for parent gallery access

-- =====================================================
-- DISCOVERED_FACES: Remove restrictive policies
-- =====================================================

-- Drop the restrictive admin-only policy
DROP POLICY IF EXISTS "Admins can manage discovered faces" ON discovered_faces;
DROP POLICY IF EXISTS "Public can view discovered faces" ON discovered_faces;

-- Create simple MVP policy (same as other tables)
CREATE POLICY "discovered_faces_all" ON discovered_faces
FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- VERIFY ALL TABLES HAVE CONSISTENT MVP POLICIES
-- These should already exist from 003, but ensure they do
-- =====================================================

-- locations
DROP POLICY IF EXISTS "locations_all" ON locations;
CREATE POLICY "locations_all" ON locations FOR ALL USING (true) WITH CHECK (true);

-- families (will be restricted later for gallery access if needed)
DROP POLICY IF EXISTS "families_all" ON families;
CREATE POLICY "families_all" ON families FOR ALL USING (true) WITH CHECK (true);

-- children
DROP POLICY IF EXISTS "children_all" ON children;
CREATE POLICY "children_all" ON children FOR ALL USING (true) WITH CHECK (true);

-- photo_sessions
DROP POLICY IF EXISTS "sessions_all" ON photo_sessions;
CREATE POLICY "sessions_all" ON photo_sessions FOR ALL USING (true) WITH CHECK (true);

-- photos
DROP POLICY IF EXISTS "photos_all" ON photos;
CREATE POLICY "photos_all" ON photos FOR ALL USING (true) WITH CHECK (true);

-- photo_children
DROP POLICY IF EXISTS "photo_children_all" ON photo_children;
CREATE POLICY "photo_children_all" ON photo_children FOR ALL USING (true) WITH CHECK (true);

-- orders
DROP POLICY IF EXISTS "orders_all" ON orders;
CREATE POLICY "orders_all" ON orders FOR ALL USING (true) WITH CHECK (true);

-- order_items
DROP POLICY IF EXISTS "order_items_all" ON order_items;
CREATE POLICY "order_items_all" ON order_items FOR ALL USING (true) WITH CHECK (true);

-- products
DROP POLICY IF EXISTS "products_all" ON products;
CREATE POLICY "products_all" ON products FOR ALL USING (true) WITH CHECK (true);

-- users
DROP POLICY IF EXISTS "users_all" ON users;
CREATE POLICY "users_all" ON users FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- COMMENT: Future considerations for production
-- =====================================================
-- When ready for production, consider:
-- 1. Add proper auth for admin dashboard
-- 2. Gallery access: validate access_code in application code (safer than RLS)
-- 3. Order creation: validate family exists in application code
--
-- For now, all security is handled at the application layer through:
-- - Server actions with proper validation
-- - API routes with service role when needed
-- - Access code validation in gallery page
