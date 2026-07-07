GRANT EXECUTE ON FUNCTION public.is_admin_of(uuid, uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.is_admin_of(uuid, uuid) IS
  'SECURITY DEFINER helper used by RLS. Keep strict equality on user_id and semester_id from auth.uid(); anon/authenticated need EXECUTE because public read policies reference it.';