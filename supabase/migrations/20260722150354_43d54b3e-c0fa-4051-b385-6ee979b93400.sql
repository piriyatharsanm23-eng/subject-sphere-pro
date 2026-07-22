
-- Attach trigger for student_requests (function exists but wasn't attached)
DROP TRIGGER IF EXISTS trg_notify_admins_on_student_request ON public.student_requests;
CREATE TRIGGER trg_notify_admins_on_student_request
AFTER INSERT ON public.student_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_student_request();

-- Feedback notifications
CREATE OR REPLACE FUNCTION public.notify_admins_on_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _subject text;
  _sem_name text;
BEGIN
  SELECT s.name INTO _subject FROM public.subjects s WHERE s.id = NEW.subject_id;
  SELECT sm.name INTO _sem_name FROM public.semesters sm WHERE sm.id = NEW.semester_id;

  INSERT INTO public.notifications (user_id, kind, title, body, link)
  SELECT ur.user_id,
         'feedback',
         'New student feedback',
         COALESCE(_subject, 'A subject') || ' (' || COALESCE(_sem_name, 'semester') || ')'
           || CASE WHEN NEW.rating IS NOT NULL THEN ' — ' || NEW.rating || '★' ELSE '' END
           || ': ' || left(COALESCE(NEW.feedback_text, ''), 160),
         '/admin/feedback'
    FROM public.user_roles ur
   WHERE (ur.role = 'admin' AND ur.assigned_semester_id = NEW.semester_id);

  INSERT INTO public.notifications (user_id, kind, title, body, link)
  SELECT ur.user_id,
         'feedback',
         'New student feedback',
         COALESCE(_subject, 'A subject') || ' (' || COALESCE(_sem_name, 'semester') || ')'
           || CASE WHEN NEW.rating IS NOT NULL THEN ' — ' || NEW.rating || '★' ELSE '' END
           || ': ' || left(COALESCE(NEW.feedback_text, ''), 160),
         '/super/feedback'
    FROM public.user_roles ur
   WHERE ur.role = 'super_admin';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_on_feedback ON public.feedback;
CREATE TRIGGER trg_notify_admins_on_feedback
AFTER INSERT ON public.feedback
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_feedback();

-- Module request notifications
CREATE OR REPLACE FUNCTION public.notify_admins_on_module_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sem_name text;
BEGIN
  SELECT sm.name INTO _sem_name FROM public.semesters sm WHERE sm.id = NEW.semester_id;

  INSERT INTO public.notifications (user_id, kind, title, body, link)
  SELECT ur.user_id,
         'module_request',
         'New module request',
         COALESCE(_sem_name, 'Semester') || ': ' || NEW.name
           || CASE WHEN NEW.code IS NOT NULL THEN ' (' || NEW.code || ')' ELSE '' END,
         '/super/modules'
    FROM public.user_roles ur
   WHERE ur.role = 'super_admin';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_on_module_request ON public.module_requests;
CREATE TRIGGER trg_notify_admins_on_module_request
AFTER INSERT ON public.module_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_module_request();
