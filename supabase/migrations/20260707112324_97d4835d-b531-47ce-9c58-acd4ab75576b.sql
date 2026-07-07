ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

CREATE OR REPLACE VIEW public.super_admin_contacts
WITH (security_invoker = false) AS
SELECT p.id, p.full_name, p.avatar_url, p.phone, p.email
FROM public.profiles p
JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'super_admin';

GRANT SELECT ON public.super_admin_contacts TO authenticated;