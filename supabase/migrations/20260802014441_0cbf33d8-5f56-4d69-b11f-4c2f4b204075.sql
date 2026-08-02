DROP POLICY IF EXISTS "Authenticated can view super admin profiles" ON public.profiles;

DROP POLICY IF EXISTS "Public can view admin role assignments" ON public.user_roles;

CREATE OR REPLACE FUNCTION public.get_support_contacts()
RETURNS TABLE (id uuid, full_name text, avatar_url text, phone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url, p.phone
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'super_admin'
  WHERE auth.uid() IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.get_support_contacts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_support_contacts() TO authenticated;