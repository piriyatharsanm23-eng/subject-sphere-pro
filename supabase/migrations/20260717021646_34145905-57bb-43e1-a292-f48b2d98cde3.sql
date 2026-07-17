
DROP POLICY IF EXISTS "Authenticated users can read AI explanations" ON public.ai_explanations;
CREATE POLICY "Authenticated users can read AI explanations for accessible materials"
ON public.ai_explanations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.materials m
    JOIN public.semesters s ON s.id = m.semester_id
    WHERE m.id = ai_explanations.material_id
      AND m.is_archived = false
      AND m.pending_delete = false
      AND s.is_active = true
  )
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.materials m
    WHERE m.id = ai_explanations.material_id
      AND public.is_admin_of(auth.uid(), m.semester_id)
  )
);

DROP POLICY IF EXISTS "Anyone can read AI settings" ON public.ai_settings;
CREATE POLICY "Authenticated users can read AI settings"
ON public.ai_settings
FOR SELECT
TO authenticated
USING (true);

REVOKE SELECT ON public.ai_settings FROM anon;
