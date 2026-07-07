
-- Allow anon to read profile info again (names/avatars are intentionally public for contributor listings)
DROP POLICY IF EXISTS "Public read profile info" ON public.public_profile_info;
CREATE POLICY "Public read profile info"
  ON public.public_profile_info
  FOR SELECT TO anon, authenticated
  USING (true);

-- Allow anon to see admin/super_admin role assignments (needed for public contributors view)
DROP POLICY IF EXISTS "Public can view admin role assignments" ON public.user_roles;
CREATE POLICY "Public can view admin role assignments"
  ON public.user_roles
  FOR SELECT TO anon, authenticated
  USING (role IN ('admin'::app_role, 'super_admin'::app_role));
