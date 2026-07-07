DROP VIEW IF EXISTS public.super_admin_contacts;

CREATE POLICY "Authenticated can view super admin profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(id, 'super_admin'));

CREATE VIEW public.super_admin_contacts
WITH (security_invoker = true) AS
SELECT p.id, p.full_name, p.avatar_url, p.phone, p.email
FROM public.profiles p
WHERE public.has_role(p.id, 'super_admin');

GRANT SELECT ON public.super_admin_contacts TO authenticated;