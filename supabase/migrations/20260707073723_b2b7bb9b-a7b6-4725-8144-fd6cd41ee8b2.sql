
-- 1. Allow multiple admin rows per user (one per semester)
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_sem_uniq
  ON public.user_roles (user_id, role, COALESCE(assigned_semester_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 2. New helper: is user admin of a specific semester
CREATE OR REPLACE FUNCTION public.is_admin_of(_user_id uuid, _semester_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin' AND assigned_semester_id = _semester_id
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_admin_of(uuid, uuid) TO authenticated, anon;

-- 3. Rewrite policies to use is_admin_of

-- semesters
DROP POLICY IF EXISTS "Public can read active semesters" ON public.semesters;
CREATE POLICY "Public can read active semesters" ON public.semesters
  FOR SELECT
  USING (is_active = true OR public.is_super_admin(auth.uid()) OR public.is_admin_of(auth.uid(), id));

-- subjects
DROP POLICY IF EXISTS "Admin/Super manage subjects in their semester" ON public.subjects;
CREATE POLICY "Admin/Super manage subjects in their semester" ON public.subjects
  FOR ALL
  USING (public.is_super_admin(auth.uid()) OR public.is_admin_of(auth.uid(), semester_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_admin_of(auth.uid(), semester_id));

-- materials
DROP POLICY IF EXISTS "Admin/Super manage materials in their semester" ON public.materials;
CREATE POLICY "Admin/Super manage materials in their semester" ON public.materials
  FOR ALL
  USING (public.is_super_admin(auth.uid()) OR public.is_admin_of(auth.uid(), semester_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_admin_of(auth.uid(), semester_id));

-- deadlines
DROP POLICY IF EXISTS "Admin/Super manage deadlines in their semester" ON public.deadlines;
CREATE POLICY "Admin/Super manage deadlines in their semester" ON public.deadlines
  FOR ALL
  USING (public.is_super_admin(auth.uid()) OR public.is_admin_of(auth.uid(), semester_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_admin_of(auth.uid(), semester_id));

DROP POLICY IF EXISTS "Public can read active deadlines" ON public.deadlines;
CREATE POLICY "Public can read active deadlines" ON public.deadlines
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_admin_of(auth.uid(), semester_id)
    OR (status = 'active' AND deadline_at > now())
  );

-- student_requests
DROP POLICY IF EXISTS "Admin/Super read requests for their semester" ON public.student_requests;
CREATE POLICY "Admin/Super read requests for their semester" ON public.student_requests
  FOR SELECT
  USING (public.is_super_admin(auth.uid()) OR public.is_admin_of(auth.uid(), semester_id));

DROP POLICY IF EXISTS "Admin/Super update requests for their semester" ON public.student_requests;
CREATE POLICY "Admin/Super update requests for their semester" ON public.student_requests
  FOR UPDATE
  USING (public.is_super_admin(auth.uid()) OR public.is_admin_of(auth.uid(), semester_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_admin_of(auth.uid(), semester_id));

-- feedback
DROP POLICY IF EXISTS "Admin/Super read feedback for their semester" ON public.feedback;
CREATE POLICY "Admin/Super read feedback for their semester" ON public.feedback
  FOR SELECT
  USING (public.is_super_admin(auth.uid()) OR public.is_admin_of(auth.uid(), semester_id));

-- downloads
DROP POLICY IF EXISTS "Admin/Super read downloads" ON public.downloads;
CREATE POLICY "Admin/Super read downloads" ON public.downloads
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.materials m
      WHERE m.id = downloads.material_id
        AND public.is_admin_of(auth.uid(), m.semester_id)
    )
  );

-- activity_logs insert policy
DROP POLICY IF EXISTS "Admins insert own activity logs" ON public.activity_logs;
CREATE POLICY "Admins insert own activity logs" ON public.activity_logs
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.is_super_admin(auth.uid())
      OR (
        public.has_role(auth.uid(), 'admin')
        AND (semester_id IS NULL OR public.is_admin_of(auth.uid(), semester_id))
      )
    )
  );

-- storage bucket policies for learning-materials
DROP POLICY IF EXISTS "Admin/Super can upload to their semester" ON storage.objects;
CREATE POLICY "Admin/Super can upload to their semester" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'learning-materials'
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_admin_of(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );

DROP POLICY IF EXISTS "Admin/Super can update files in their semester" ON storage.objects;
CREATE POLICY "Admin/Super can update files in their semester" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'learning-materials'
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_admin_of(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );

DROP POLICY IF EXISTS "Admin/Super can delete files in their semester" ON storage.objects;
CREATE POLICY "Admin/Super can delete files in their semester" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'learning-materials'
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_admin_of(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );
