
-- 1) Restrict raw public_profile_info to authenticated users only
DROP POLICY IF EXISTS "Public read profile info" ON public.public_profile_info;
CREATE POLICY "Authenticated read profile info"
  ON public.public_profile_info
  FOR SELECT TO authenticated
  USING (true);

-- 2) Allow authenticated users to view admin/super admin role assignments (for contributors listing)
DROP POLICY IF EXISTS "Authenticated can view admin role assignments" ON public.user_roles;
CREATE POLICY "Authenticated can view admin role assignments"
  ON public.user_roles
  FOR SELECT TO authenticated
  USING (role IN ('admin'::app_role, 'super_admin'::app_role));

-- 3) Allow authenticated users to view super admin profiles (for admin guide contact panel)
DROP POLICY IF EXISTS "Authenticated can view super admin profiles" ON public.profiles;
CREATE POLICY "Authenticated can view super admin profiles"
  ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_super_admin(id));

-- 4) Switch views to security_invoker so they enforce the caller's RLS
ALTER VIEW public.public_contributors SET (security_invoker = true);
ALTER VIEW public.super_admin_contacts SET (security_invoker = true);

-- 5) Document invariant on is_admin_of
COMMENT ON FUNCTION public.is_admin_of(uuid, uuid) IS
  'SECURITY DEFINER helper. MUST keep strict equality on user_id and semester_id from auth.uid() to avoid privilege escalation. Do not relax these checks.';
