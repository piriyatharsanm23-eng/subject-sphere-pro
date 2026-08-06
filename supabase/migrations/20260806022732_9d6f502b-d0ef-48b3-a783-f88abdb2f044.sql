
CREATE OR REPLACE FUNCTION public.is_public_contributor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.materials m WHERE m.uploaded_by = _user_id)
      OR EXISTS (SELECT 1 FROM public.kuppi_videos k WHERE k.uploaded_by = _user_id)
      OR EXISTS (SELECT 1 FROM public.deadlines d WHERE d.created_by = _user_id)
$$;

DROP POLICY IF EXISTS "Public read profile info" ON public.public_profile_info;

CREATE POLICY "Anon can view contributor profile info"
  ON public.public_profile_info FOR SELECT
  TO anon
  USING (public.is_public_contributor(id));

DROP POLICY IF EXISTS "Authenticated can view admin role assignments" ON public.user_roles;
