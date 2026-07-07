CREATE OR REPLACE FUNCTION public.is_admin_of(_user_id uuid, _semester_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
      AND assigned_semester_id = _semester_id
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_of(uuid, uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.is_admin_of(uuid, uuid) IS
  'SECURITY INVOKER helper used by RLS and public read policies. It only checks exact user_id/admin/semester matches visible through normal user_roles RLS.';