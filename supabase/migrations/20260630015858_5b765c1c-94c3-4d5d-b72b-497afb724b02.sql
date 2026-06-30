
-- 1) Remove PII columns from feedback & student_requests
ALTER TABLE public.feedback DROP COLUMN IF EXISTS student_name;
ALTER TABLE public.feedback DROP COLUMN IF EXISTS student_email;
ALTER TABLE public.student_requests DROP COLUMN IF EXISTS student_name;
ALTER TABLE public.student_requests DROP COLUMN IF EXISTS student_email;

-- 2) Replace permissive INSERT policies with constrained ones
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
CREATE POLICY "Anyone can submit feedback"
  ON public.feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    semester_id IS NOT NULL
    AND length(feedback_text) BETWEEN 1 AND 2000
    AND (rating IS NULL OR rating BETWEEN 1 AND 5)
  );

DROP POLICY IF EXISTS "Anyone can submit a request" ON public.student_requests;
CREATE POLICY "Anyone can submit a request"
  ON public.student_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    semester_id IS NOT NULL
    AND length(request_text) BETWEEN 1 AND 2000
    AND status = 'pending'
  );

-- 3) Tighten activity_logs insert to admin's assigned semester
DROP POLICY IF EXISTS "Admins insert own activity logs" ON public.activity_logs;
CREATE POLICY "Admins insert own activity logs"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.is_super_admin(auth.uid())
      OR (
        public.has_role(auth.uid(), 'admin'::app_role)
        AND (semester_id IS NULL OR semester_id = public.admin_semester(auth.uid()))
      )
    )
  );

-- 4) Downloads: explicit deny-all insert policy (writes go through SECURITY DEFINER increment_download)
DROP POLICY IF EXISTS "No direct download inserts" ON public.downloads;
CREATE POLICY "No direct download inserts"
  ON public.downloads FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

-- 5) Lock down SECURITY DEFINER function EXECUTE grants
-- Internal RLS helpers: not callable from API
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_semester(uuid) FROM PUBLIC, anon, authenticated;

-- Trigger functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- log_activity: only signed-in admins/super-admins
REVOKE ALL ON FUNCTION public.log_activity(text, text, text, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_activity(text, text, text, uuid, uuid, uuid) TO authenticated;

-- increment_download: anonymous students need this
REVOKE ALL ON FUNCTION public.increment_download(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_download(uuid) TO anon, authenticated;
