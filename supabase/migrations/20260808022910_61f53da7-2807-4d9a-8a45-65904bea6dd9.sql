DROP POLICY IF EXISTS "Public can read non-archived learning materials" ON storage.objects;

CREATE POLICY "Public can read non-archived learning materials"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'learning-materials'
  AND (
    EXISTS (
      SELECT 1
      FROM public.materials m
      JOIN public.semesters s ON s.id = m.semester_id
      WHERE m.file_url = storage.objects.name
        AND m.is_archived = false
        AND s.is_active = true
    )
    OR public.is_super_admin(auth.uid())
    OR public.is_admin_of(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);