CREATE OR REPLACE VIEW public.public_contributors
WITH (security_invoker = true)
AS
SELECT
  ur.user_id AS id,
  ur.role::text AS role,
  ur.assigned_semester_id,
  s.name AS semester_name,
  ppi.full_name,
  ppi.avatar_url
FROM public.user_roles ur
LEFT JOIN public.semesters s ON s.id = ur.assigned_semester_id
LEFT JOIN public.public_profile_info ppi ON ppi.id = ur.user_id
WHERE ur.role = 'admin';

GRANT SELECT ON public.public_contributors TO anon, authenticated;