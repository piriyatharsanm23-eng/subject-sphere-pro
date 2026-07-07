
-- 1. Drop downloads infra
DROP TRIGGER IF EXISTS trg_bump_material_download_count ON public.downloads;
DROP TRIGGER IF EXISTS trg_validate_download_insert ON public.downloads;
DROP TABLE IF EXISTS public.downloads CASCADE;
DROP FUNCTION IF EXISTS public.bump_material_download_count() CASCADE;
DROP FUNCTION IF EXISTS public.validate_download_insert() CASCADE;
ALTER TABLE public.materials DROP COLUMN IF EXISTS download_count;

-- 2. Drop telegram_health_logs
DROP TABLE IF EXISTS public.telegram_health_logs CASCADE;

-- 3. Replace telegram_subject_enrollments with jsonb array on subscribers
ALTER TABLE public.telegram_subscribers
  ADD COLUMN IF NOT EXISTS subject_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

-- Migrate existing enrollments into the array
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='telegram_subject_enrollments') THEN
    UPDATE public.telegram_subscribers ts
       SET subject_ids = sub.arr
      FROM (
        SELECT chat_id, array_agg(DISTINCT subject_id) AS arr
          FROM public.telegram_subject_enrollments
         GROUP BY chat_id
      ) sub
     WHERE ts.chat_id = sub.chat_id;
  END IF;
END $$;

DROP TABLE IF EXISTS public.telegram_subject_enrollments CASCADE;

-- 4. Kuppi videos
CREATE TABLE public.kuppi_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sections_covered text,
  medium text NOT NULL CHECK (medium IN ('sinhala','tamil','english')),
  video_url text NOT NULL,
  presenter_name text NOT NULL,
  presenter_photo_url text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.kuppi_videos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kuppi_videos TO authenticated;
GRANT ALL ON public.kuppi_videos TO service_role;

ALTER TABLE public.kuppi_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view kuppi videos"
  ON public.kuppi_videos FOR SELECT
  USING (true);

CREATE POLICY "Semester admins can insert kuppi videos"
  ON public.kuppi_videos FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_admin_of(auth.uid(), semester_id));

CREATE POLICY "Semester admins can update kuppi videos"
  ON public.kuppi_videos FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_admin_of(auth.uid(), semester_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_admin_of(auth.uid(), semester_id));

CREATE POLICY "Semester admins can delete kuppi videos"
  ON public.kuppi_videos FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_admin_of(auth.uid(), semester_id));

CREATE TRIGGER trg_kuppi_videos_updated_at
  BEFORE UPDATE ON public.kuppi_videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_kuppi_videos_subject ON public.kuppi_videos(subject_id);
CREATE INDEX idx_kuppi_videos_semester ON public.kuppi_videos(semester_id);
CREATE INDEX idx_kuppi_videos_medium ON public.kuppi_videos(medium);

-- 5. Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark their notifications read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read_at, created_at DESC);

-- 6. Fan-out trigger on new student requests
CREATE OR REPLACE FUNCTION public.notify_admins_on_student_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _subject text;
  _sem_name text;
BEGIN
  SELECT s.name INTO _subject FROM public.subjects s WHERE s.id = NEW.subject_id;
  SELECT sm.name INTO _sem_name FROM public.semesters sm WHERE sm.id = NEW.semester_id;

  INSERT INTO public.notifications (user_id, kind, title, body, link)
  SELECT ur.user_id,
         'student_request',
         'New material request',
         COALESCE(_subject, 'A subject') || ' (' || COALESCE(_sem_name, 'semester') || '): ' ||
           left(NEW.request_text, 160),
         '/admin/requests'
    FROM public.user_roles ur
   WHERE (ur.role = 'admin' AND ur.assigned_semester_id = NEW.semester_id)
      OR ur.role = 'super_admin';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_on_student_request ON public.student_requests;
CREATE TRIGGER trg_notify_admins_on_student_request
  AFTER INSERT ON public.student_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_student_request();
