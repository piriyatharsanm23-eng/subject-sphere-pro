DROP POLICY IF EXISTS "Authenticated read profile info" ON public.public_profile_info;

CREATE POLICY "Authenticated can view contributor profile info"
ON public.public_profile_info
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.is_public_contributor(id)
  OR public.is_super_admin(auth.uid())
);