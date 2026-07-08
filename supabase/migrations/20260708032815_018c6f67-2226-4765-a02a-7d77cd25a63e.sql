ALTER TABLE public.materials     ADD COLUMN IF NOT EXISTS pending_delete boolean NOT NULL DEFAULT false;
ALTER TABLE public.deadlines     ADD COLUMN IF NOT EXISTS pending_delete boolean NOT NULL DEFAULT false;
ALTER TABLE public.kuppi_videos  ADD COLUMN IF NOT EXISTS pending_delete boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.pending_changes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type    text NOT NULL CHECK (entity_type IN ('material','deadline','kuppi')),
  entity_id      uuid NOT NULL,
  action         text NOT NULL CHECK (action IN ('update','delete')),
  proposed_data  jsonb,
  snapshot       jsonb NOT NULL,
  requested_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  semester_id    uuid REFERENCES public.semesters(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at    timestamptz,
  reject_reason  text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_changes TO authenticated;
GRANT ALL ON public.pending_changes TO service_role;

ALTER TABLE public.pending_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read all pending changes"
  ON public.pending_changes FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Semester admins read their pending changes"
  ON public.pending_changes FOR SELECT TO authenticated
  USING (public.admin_semester(auth.uid()) = semester_id);

CREATE POLICY "Admins insert pending changes for their semester"
  ON public.pending_changes FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.admin_semester(auth.uid()) = semester_id
  );

CREATE POLICY "Super admins update pending changes"
  ON public.pending_changes FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_pending_changes_status ON public.pending_changes(status);
CREATE INDEX IF NOT EXISTS idx_pending_changes_semester ON public.pending_changes(semester_id);
CREATE INDEX IF NOT EXISTS idx_pending_changes_entity ON public.pending_changes(entity_type, entity_id);