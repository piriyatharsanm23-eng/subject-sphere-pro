
-- 1. Switch SECURITY DEFINER role helpers to SECURITY INVOKER.
-- All callers pass auth.uid(); user_roles RLS lets the current user see their own row.
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.admin_semester(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT assigned_semester_id FROM public.user_roles WHERE user_id = _user_id AND role = 'admin' LIMIT 1
$$;

-- 2. Attach existing metadata-setter as BEFORE INSERT trigger on activity_logs
DROP TRIGGER IF EXISTS set_activity_log_metadata_trg ON public.activity_logs;
CREATE TRIGGER set_activity_log_metadata_trg
  BEFORE INSERT ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_activity_log_metadata();

-- 3. Downloads rate-limit trigger
CREATE OR REPLACE FUNCTION public.validate_download_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.material_id IS NULL THEN
    RAISE EXCEPTION 'material_id is required';
  END IF;
  IF (SELECT count(*) FROM public.downloads
      WHERE material_id = NEW.material_id
        AND downloaded_at > now() - interval '1 minute') >= 30 THEN
    RAISE EXCEPTION 'Download rate limit exceeded for this material';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_download_insert_trg ON public.downloads;
CREATE TRIGGER validate_download_insert_trg
  BEFORE INSERT ON public.downloads
  FOR EACH ROW EXECUTE FUNCTION public.validate_download_insert();

-- 4. Restrict storage SELECT on learning-materials to non-archived materials
DROP POLICY IF EXISTS "Public can read learning materials" ON storage.objects;
CREATE POLICY "Public can read non-archived learning materials"
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'learning-materials'
  AND EXISTS (
    SELECT 1 FROM public.materials m
    WHERE m.file_url = storage.objects.name AND m.is_archived = false
  )
);

-- 5. Explicit super-admin-only management policies for Telegram tables
DROP POLICY IF EXISTS "Super admin manages telegram enrollments" ON public.telegram_subject_enrollments;
CREATE POLICY "Super admin manages telegram enrollments"
ON public.telegram_subject_enrollments FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admin manages telegram subscribers" ON public.telegram_subscribers;
CREATE POLICY "Super admin manages telegram subscribers"
ON public.telegram_subscribers FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));
