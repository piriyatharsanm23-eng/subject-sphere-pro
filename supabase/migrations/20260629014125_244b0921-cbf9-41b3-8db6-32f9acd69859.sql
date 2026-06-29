
-- =========================================================
-- ROLES
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'super_admin');

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- USER ROLES (separate table — never on profiles)
-- =========================================================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  assigned_semester_id uuid, -- only relevant for 'admin'
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- SECURITY DEFINER HELPERS
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.admin_semester(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT assigned_semester_id FROM public.user_roles
  WHERE user_id = _user_id AND role = 'admin'
  LIMIT 1
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- PROFILES POLICIES
-- =========================================================
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- =========================================================
-- USER_ROLES POLICIES
-- =========================================================
CREATE POLICY "Users can view their own role"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- =========================================================
-- SEMESTERS
-- =========================================================
CREATE TABLE public.semesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.semesters TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.semesters TO authenticated;
GRANT ALL ON public.semesters TO service_role;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active semesters"
  ON public.semesters FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.is_super_admin(auth.uid()) OR public.admin_semester(auth.uid()) = id);

CREATE POLICY "Super admin manages semesters"
  ON public.semesters FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER semesters_updated_at BEFORE UPDATE ON public.semesters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add FK from user_roles -> semesters (deferred because semesters didn't exist)
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_semester_fk
  FOREIGN KEY (assigned_semester_id) REFERENCES public.semesters(id) ON DELETE SET NULL;

-- =========================================================
-- SUBJECTS
-- =========================================================
CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subjects TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read subjects"
  ON public.subjects FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admin/Super manage subjects in their semester"
  ON public.subjects FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.admin_semester(auth.uid()) = semester_id)
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.admin_semester(auth.uid()) = semester_id);

CREATE TRIGGER subjects_updated_at BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- MATERIALS
-- =========================================================
CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  material_type text NOT NULL CHECK (material_type IN ('lecture_slide','note','past_paper','assignment','other')),
  file_url text NOT NULL,
  file_name text,
  file_type text,
  year text,
  week_or_module text,
  download_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.materials TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read materials"
  ON public.materials FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admin/Super manage materials in their semester"
  ON public.materials FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.admin_semester(auth.uid()) = semester_id)
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.admin_semester(auth.uid()) = semester_id);

CREATE TRIGGER materials_updated_at BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC to increment download count + log (public callable)
CREATE OR REPLACE FUNCTION public.increment_download(_material_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.materials SET download_count = download_count + 1 WHERE id = _material_id;
  INSERT INTO public.downloads (material_id) VALUES (_material_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.increment_download(uuid) TO anon, authenticated;

-- =========================================================
-- DEADLINES
-- =========================================================
CREATE TABLE public.deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  deadline_at timestamptz NOT NULL,
  attachment_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','archived')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.deadlines TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.deadlines TO authenticated;
GRANT ALL ON public.deadlines TO service_role;
ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;

-- Public sees only active and not yet expired
CREATE POLICY "Public can read active deadlines"
  ON public.deadlines FOR SELECT TO anon, authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.admin_semester(auth.uid()) = semester_id
    OR (status = 'active' AND deadline_at > now())
  );

CREATE POLICY "Admin/Super manage deadlines in their semester"
  ON public.deadlines FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.admin_semester(auth.uid()) = semester_id)
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.admin_semester(auth.uid()) = semester_id);

CREATE TRIGGER deadlines_updated_at BEFORE UPDATE ON public.deadlines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- STUDENT REQUESTS
-- =========================================================
CREATE TABLE public.student_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid REFERENCES public.semesters(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  request_text text NOT NULL,
  student_name text,
  student_email text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.student_requests TO anon, authenticated;
GRANT UPDATE, DELETE ON public.student_requests TO authenticated;
GRANT ALL ON public.student_requests TO service_role;
ALTER TABLE public.student_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a request"
  ON public.student_requests FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admin/Super read requests for their semester"
  ON public.student_requests FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.admin_semester(auth.uid()) = semester_id);

CREATE POLICY "Admin/Super update requests for their semester"
  ON public.student_requests FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.admin_semester(auth.uid()) = semester_id)
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.admin_semester(auth.uid()) = semester_id);

CREATE POLICY "Super admin deletes requests"
  ON public.student_requests FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER student_requests_updated_at BEFORE UPDATE ON public.student_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- FEEDBACK
-- =========================================================
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid REFERENCES public.semesters(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  feedback_text text NOT NULL,
  student_name text,
  student_email text,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.feedback TO anon, authenticated;
GRANT UPDATE, DELETE ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit feedback"
  ON public.feedback FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admin/Super read feedback for their semester"
  ON public.feedback FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.admin_semester(auth.uid()) = semester_id);

CREATE POLICY "Super admin deletes feedback"
  ON public.feedback FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- =========================================================
-- DOWNLOADS
-- =========================================================
CREATE TABLE public.downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid REFERENCES public.materials(id) ON DELETE CASCADE,
  downloaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.downloads TO authenticated;
GRANT ALL ON public.downloads TO service_role;
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Super read downloads"
  ON public.downloads FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.materials m
    WHERE m.id = downloads.material_id
      AND public.admin_semester(auth.uid()) = m.semester_id
  ));

-- =========================================================
-- INDEXES
-- =========================================================
CREATE INDEX idx_subjects_semester ON public.subjects(semester_id);
CREATE INDEX idx_materials_subject ON public.materials(subject_id);
CREATE INDEX idx_materials_semester ON public.materials(semester_id);
CREATE INDEX idx_materials_type ON public.materials(material_type);
CREATE INDEX idx_deadlines_semester ON public.deadlines(semester_id);
CREATE INDEX idx_deadlines_at ON public.deadlines(deadline_at);
CREATE INDEX idx_requests_semester ON public.student_requests(semester_id);
CREATE INDEX idx_feedback_semester ON public.feedback(semester_id);

-- =========================================================
-- STORAGE BUCKET POLICIES (bucket created via separate tool call)
-- =========================================================
-- Policies on storage.objects for bucket 'learning-materials'
CREATE POLICY "Public can read learning materials"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'learning-materials');

CREATE POLICY "Admin/Super can upload to their semester"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'learning-materials' AND (
      public.is_super_admin(auth.uid())
      OR public.admin_semester(auth.uid())::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Admin/Super can update files in their semester"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'learning-materials' AND (
      public.is_super_admin(auth.uid())
      OR public.admin_semester(auth.uid())::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Admin/Super can delete files in their semester"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'learning-materials' AND (
      public.is_super_admin(auth.uid())
      OR public.admin_semester(auth.uid())::text = (storage.foldername(name))[1]
    )
  );
