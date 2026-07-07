
-- 1) Restrict user_roles: remove anon/public read; contributors view keeps working via security definer.
DROP POLICY IF EXISTS "Public can view admin role assignments" ON public.user_roles;

-- Recreate public_contributors as SECURITY DEFINER so anon can still see admin cards
-- via the view without exposing user_roles directly.
DROP VIEW IF EXISTS public.public_contributors;
CREATE VIEW public.public_contributors
WITH (security_invoker = false)
AS
SELECT ur.user_id AS id,
       (ur.role)::text AS role,
       ur.assigned_semester_id,
       s.name AS semester_name,
       ppi.full_name,
       ppi.avatar_url
  FROM public.user_roles ur
  LEFT JOIN public.semesters s ON s.id = ur.assigned_semester_id
  LEFT JOIN public.public_profile_info ppi ON ppi.id = ur.user_id
 WHERE ur.role = 'admin'::public.app_role;

REVOKE ALL ON public.public_contributors FROM PUBLIC;
GRANT SELECT ON public.public_contributors TO anon, authenticated;

-- 2) Stop exposing super admin email/phone directly from profiles.
DROP POLICY IF EXISTS "Authenticated can view super admin profiles" ON public.profiles;

DROP VIEW IF EXISTS public.super_admin_contacts;
CREATE VIEW public.super_admin_contacts
WITH (security_invoker = false)
AS
SELECT id, full_name, avatar_url, phone, email
  FROM public.profiles p
 WHERE public.has_role(id, 'super_admin'::public.app_role);

REVOKE ALL ON public.super_admin_contacts FROM PUBLIC;
GRANT SELECT ON public.super_admin_contacts TO authenticated;

-- 3) Materials: hide items whose semester is inactive.
DROP POLICY IF EXISTS "Public can read materials" ON public.materials;
CREATE POLICY "Public can read materials"
ON public.materials
FOR SELECT
TO public
USING (
  is_archived = false
  AND EXISTS (
    SELECT 1 FROM public.semesters s
     WHERE s.id = materials.semester_id AND s.is_active = true
  )
);

-- 4) Kuppi videos: only show for active semesters (admins keep full view via other policies).
DROP POLICY IF EXISTS "Anyone can view kuppi videos" ON public.kuppi_videos;
CREATE POLICY "Anyone can view kuppi videos"
ON public.kuppi_videos
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.semesters s
     WHERE s.id = kuppi_videos.semester_id AND s.is_active = true
  )
  OR public.is_super_admin(auth.uid())
  OR public.is_admin_of(auth.uid(), kuppi_videos.semester_id)
);

-- 5) Activity logs: prevent role/name spoofing on insert.
-- A BEFORE INSERT trigger (set_activity_log_metadata) already exists and overwrites
-- user_id/user_name/user_role with the authenticated caller's real values, so the
-- INSERT policy just needs to be scoped to authenticated inserters.
DROP POLICY IF EXISTS "Admins insert own activity logs" ON public.activity_logs;
CREATE POLICY "Admins insert own activity logs"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND (semester_id IS NULL OR public.is_admin_of(auth.uid(), semester_id))
  )
);

-- Ensure the metadata trigger is attached so user_name/user_role can't be spoofed.
DROP TRIGGER IF EXISTS trg_set_activity_log_metadata ON public.activity_logs;
CREATE TRIGGER trg_set_activity_log_metadata
BEFORE INSERT ON public.activity_logs
FOR EACH ROW EXECUTE FUNCTION public.set_activity_log_metadata();

-- 6) Lock down SECURITY DEFINER functions that shouldn't be callable from the API.
-- is_admin_of is used inside RLS policies (server-side) — callers do not need EXECUTE.
REVOKE EXECUTE ON FUNCTION public.is_admin_of(uuid, uuid) FROM PUBLIC, anon, authenticated;
-- notify_admins_on_student_request is a trigger-only function.
REVOKE EXECUTE ON FUNCTION public.notify_admins_on_student_request() FROM PUBLIC, anon, authenticated;
