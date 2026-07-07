
ALTER TABLE public.student_requests
  ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issue_type text;

CREATE INDEX IF NOT EXISTS idx_student_requests_material_id ON public.student_requests(material_id);
