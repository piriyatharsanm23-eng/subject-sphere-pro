-- Feedback: require signed-in user
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
CREATE POLICY "Authenticated users submit feedback"
ON public.feedback FOR INSERT TO authenticated
WITH CHECK (
  (semester_id IS NULL OR EXISTS (SELECT 1 FROM public.semesters s WHERE s.id = feedback.semester_id AND s.is_active = true))
  AND char_length(feedback_text) BETWEEN 1 AND 2000
  AND (rating IS NULL OR rating BETWEEN 1 AND 5)
);
REVOKE INSERT ON public.feedback FROM anon;

-- Student requests: require signed-in user
DROP POLICY IF EXISTS "Anyone can submit material requests" ON public.student_requests;
CREATE POLICY "Authenticated users submit material requests"
ON public.student_requests FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.semesters s WHERE s.id = student_requests.semester_id AND s.is_active = true)
  AND EXISTS (SELECT 1 FROM public.subjects sub WHERE sub.id = student_requests.subject_id AND sub.semester_id = student_requests.semester_id)
  AND char_length(request_text) BETWEEN 1 AND 2000
);
REVOKE INSERT ON public.student_requests FROM anon;

-- Site visits: keep anonymous analytics but validate the payload strictly
CREATE OR REPLACE FUNCTION public.validate_site_visit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Invalid visit payload';
  END IF;
  IF char_length(NEW.visitor_id) NOT BETWEEN 8 AND 64 THEN
    RAISE EXCEPTION 'Invalid visit payload';
  END IF;
  NEW.path := left(COALESCE(NEW.path, ''), 200);
  NEW.referrer := left(COALESCE(NEW.referrer, ''), 300);
  NEW.user_agent := left(COALESCE(NEW.user_agent, ''), 300);
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_site_visit ON public.site_visits;
CREATE TRIGGER trg_validate_site_visit
BEFORE INSERT ON public.site_visits
FOR EACH ROW EXECUTE FUNCTION public.validate_site_visit();

DROP POLICY IF EXISTS "Anyone can record a visit" ON public.site_visits;
CREATE POLICY "Visitors can record their own visit"
ON public.site_visits FOR INSERT TO anon, authenticated
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND visitor_id IS NOT NULL
  AND char_length(visitor_id) BETWEEN 8 AND 64
  AND (path IS NULL OR char_length(path) <= 200)
);