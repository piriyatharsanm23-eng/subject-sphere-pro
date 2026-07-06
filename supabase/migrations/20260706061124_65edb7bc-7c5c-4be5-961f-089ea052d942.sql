
CREATE POLICY "Public can view admin role assignments"
ON public.user_roles
FOR SELECT
TO anon, authenticated
USING (role IN ('admin','super_admin'));

GRANT SELECT ON public.user_roles TO anon;
