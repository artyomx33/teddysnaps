-- Fix infinite recursion in users table RLS policies
-- The issue: "Admin can manage users" policy queries users table to check if user is admin,
-- which triggers the same policy, causing infinite recursion.

-- Drop the problematic policies
drop policy if exists "Users can insert own profile" on users;
drop policy if exists "Users can update own profile" on users;
drop policy if exists "Admin can manage users" on users;

-- Recreate users policies without recursion
-- Use auth.jwt() to get role from JWT claims instead of querying users table

-- Users can read their own profile
create policy "Users can read own profile"
  on users for select
  using (auth.uid() = id);

-- Users can insert their own profile (on signup)
create policy "Users can insert own profile"
  on users for insert
  with check (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update own profile"
  on users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- For admin access to all users, we use a security definer function
-- This avoids the recursive policy check

-- Create a security definer function to check if user is admin
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from users
    where id = auth.uid()
    and role = 'admin'
  );
$$;

-- Admin can read all users (using security definer function)
create policy "Admin can read all users"
  on users for select
  using (is_admin());

-- Admin can update any user (using security definer function)
create policy "Admin can update all users"
  on users for update
  using (is_admin())
  with check (is_admin());

-- Admin can delete users (using security definer function)
create policy "Admin can delete users"
  on users for delete
  using (is_admin());

-- Also update the locations policy to use the function
drop policy if exists "Admin can select locations" on locations;
drop policy if exists "Admin can insert locations" on locations;
drop policy if exists "Admin can update locations" on locations;
drop policy if exists "Admin can delete locations" on locations;

create policy "Admin can select locations"
  on locations for select
  using (is_admin());

create policy "Admin can insert locations"
  on locations for insert
  with check (is_admin());

create policy "Admin can update locations"
  on locations for update
  using (is_admin())
  with check (is_admin());

create policy "Admin can delete locations"
  on locations for delete
  using (is_admin());

-- Make locations publicly readable for gallery
create policy "Public can view locations"
  on locations for select
  using (true);
