
-- Feedback: restrict semester_id on public insert to real, active semesters.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
     WHERE schemaname='public' AND tablename='feedback' AND cmd='INSERT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.feedback', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Anyone can submit feedback"
ON public.feedback
FOR INSERT
TO public
WITH CHECK (
  semester_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.semesters s
     WHERE s.id = feedback.semester_id AND s.is_active = true
  )
);

-- Student requests: same rule.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
     WHERE schemaname='public' AND tablename='student_requests' AND cmd='INSERT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.student_requests', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Anyone can submit material requests"
ON public.student_requests
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.semesters s
     WHERE s.id = student_requests.semester_id AND s.is_active = true
  )
  AND EXISTS (
    SELECT 1 FROM public.subjects sub
     WHERE sub.id = student_requests.subject_id AND sub.semester_id = student_requests.semester_id
  )
);
