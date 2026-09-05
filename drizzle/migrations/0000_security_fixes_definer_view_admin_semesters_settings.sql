-- 1) Remove SECURITY DEFINER view: move privileged read into a definer function
CREATE OR REPLACE FUNCTION public.list_public_contributors()
RETURNS TABLE(id uuid, role text, assigned_semester_id uuid, semester_name text, full_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id AS id,
         ur.role::text AS role,
         ur.assigned_semester_id,
         s.name AS semester_name,
         ppi.full_name,
         ppi.avatar_url
    FROM public.user_roles ur
    LEFT JOIN public.semesters s ON s.id = ur.assigned_semester_id
    LEFT JOIN public.public_profile_info ppi ON ppi.id = ur.user_id
   WHERE ur.role = 'admin'::app_role
$$;

REVOKE ALL ON FUNCTION public.list_public_contributors() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_contributors() TO anon, authenticated, service_role;

DROP VIEW IF EXISTS public.public_contributors;
CREATE VIEW public.public_contributors
WITH (security_invoker = true) AS
  SELECT id, role, assigned_semester_id, semester_name, full_name, avatar_url
  FROM public.list_public_contributors();

GRANT SELECT ON public.public_contributors TO anon, authenticated, service_role;

-- 2) Support admins assigned to multiple semesters
CREATE OR REPLACE FUNCTION public.admin_semesters(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT assigned_semester_id
    FROM public.user_roles
   WHERE user_id = _user_id
     AND role = 'admin'
     AND assigned_semester_id IS NOT NULL
$$;

DROP POLICY IF EXISTS "Semester admins read their pending changes" ON public.pending_changes;
CREATE POLICY "Semester admins read their pending changes"
ON public.pending_changes FOR SELECT TO authenticated
USING (semester_id IN (SELECT public.admin_semesters(auth.uid())));

DROP POLICY IF EXISTS "Admins insert pending changes for their semester" ON public.pending_changes;
CREATE POLICY "Admins insert pending changes for their semester"
ON public.pending_changes FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR semester_id IN (SELECT public.admin_semesters(auth.uid()))
);

-- 3) ai_explanations: explicitly deny client writes (service role only)
REVOKE INSERT, UPDATE, DELETE ON public.ai_explanations FROM anon, authenticated;
GRANT ALL ON public.ai_explanations TO service_role;

CREATE POLICY "No client inserts on ai explanations"
ON public.ai_explanations FOR INSERT TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "No client updates on ai explanations"
ON public.ai_explanations FOR UPDATE TO anon, authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "No client deletes on ai explanations"
ON public.ai_explanations FOR DELETE TO anon, authenticated
USING (false);

-- 4) app_settings: only expose non-sensitive public keys publicly
DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;

CREATE POLICY "Public can read public app settings"
ON public.app_settings FOR SELECT TO anon, authenticated
USING (key IN ('google_auth_enabled'));

CREATE POLICY "Super admins read all app settings"
ON public.app_settings FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));