
-- ============================================================
-- 1) Reassign Semester 4 contribution/attribution to Mohamed Rifnaz
-- ============================================================
UPDATE public.materials
SET uploaded_by = 'eb192ad3-3387-4fd4-9d6a-f2c6a36d16d2'
WHERE semester_id = '0ceeab7f-7bba-4a23-a425-13b07f5ffbdc';

-- Remove Piriyatharsan's admin-of-sem-4 role (keep him as super_admin)
DELETE FROM public.user_roles
WHERE user_id = '66d173c7-06ef-4176-9ccd-5936e343f670'
  AND role = 'admin'
  AND assigned_semester_id = '0ceeab7f-7bba-4a23-a425-13b07f5ffbdc';

-- Add Rifnaz as an admin for Semester 4 (he already admins Semester 5)
INSERT INTO public.user_roles (user_id, role, assigned_semester_id)
VALUES ('eb192ad3-3387-4fd4-9d6a-f2c6a36d16d2', 'admin', '0ceeab7f-7bba-4a23-a425-13b07f5ffbdc')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2) Module request workflow
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.module_request_status AS ENUM ('pending','accepted','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.module_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  description text,
  reason text,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.module_request_status NOT NULL DEFAULT 'pending',
  reviewer_note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_requests TO authenticated;
GRANT ALL ON public.module_requests TO service_role;

ALTER TABLE public.module_requests ENABLE ROW LEVEL SECURITY;

-- Admins can insert requests only for a semester they admin
DROP POLICY IF EXISTS "admins insert own requests" ON public.module_requests;
CREATE POLICY "admins insert own requests" ON public.module_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND (
      public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role = 'admin'
          AND ur.assigned_semester_id = module_requests.semester_id
      )
    )
  );

-- Admins can view their own requests; super admins view all
DROP POLICY IF EXISTS "requests visibility" ON public.module_requests;
CREATE POLICY "requests visibility" ON public.module_requests
  FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid() OR public.is_super_admin(auth.uid())
  );

-- Requesters can update / delete only while pending
DROP POLICY IF EXISTS "requester update own pending" ON public.module_requests;
CREATE POLICY "requester update own pending" ON public.module_requests
  FOR UPDATE TO authenticated
  USING (requested_by = auth.uid() AND status = 'pending')
  WITH CHECK (requested_by = auth.uid());

DROP POLICY IF EXISTS "requester delete own pending" ON public.module_requests;
CREATE POLICY "requester delete own pending" ON public.module_requests
  FOR DELETE TO authenticated
  USING (requested_by = auth.uid() AND status = 'pending');

-- Super admins can update anything (approve / reject)
DROP POLICY IF EXISTS "super updates any" ON public.module_requests;
CREATE POLICY "super updates any" ON public.module_requests
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Trigger: auto-create the subject when approved
CREATE OR REPLACE FUNCTION public.handle_module_request_accept()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_subject_id uuid;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    IF NEW.created_subject_id IS NULL THEN
      INSERT INTO public.subjects (semester_id, name, code, description)
      VALUES (NEW.semester_id, NEW.name, NEW.code, NEW.description)
      RETURNING id INTO new_subject_id;
      NEW.created_subject_id := new_subject_id;
    END IF;
    NEW.reviewed_at := now();
    IF NEW.reviewed_by IS NULL THEN
      NEW.reviewed_by := auth.uid();
    END IF;
  ELSIF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    NEW.reviewed_at := now();
    IF NEW.reviewed_by IS NULL THEN
      NEW.reviewed_by := auth.uid();
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_module_request_accept() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_module_requests_accept ON public.module_requests;
CREATE TRIGGER trg_module_requests_accept
BEFORE UPDATE ON public.module_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_module_request_accept();

CREATE INDEX IF NOT EXISTS idx_module_requests_status ON public.module_requests (status);
CREATE INDEX IF NOT EXISTS idx_module_requests_semester ON public.module_requests (semester_id);
CREATE INDEX IF NOT EXISTS idx_module_requests_requester ON public.module_requests (requested_by);
