
-- 1) Activity log table
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name text,
  user_role text,
  action_type text NOT NULL,
  target_type text,
  target_id uuid,
  semester_id uuid REFERENCES public.semesters(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs (created_at DESC);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs (user_id);
CREATE INDEX idx_activity_logs_action_type ON public.activity_logs (action_type);
CREATE INDEX idx_activity_logs_semester_id ON public.activity_logs (semester_id);

GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins view all activity logs"
  ON public.activity_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Admins view own activity logs"
  ON public.activity_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins insert own activity logs"
  ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))
  );

-- 2) Archive flags
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.deadlines ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- 3) Helper function used by clients to write a log row reliably
CREATE OR REPLACE FUNCTION public.log_activity(
  _action_type text,
  _description text,
  _target_type text DEFAULT NULL,
  _target_id uuid DEFAULT NULL,
  _semester_id uuid DEFAULT NULL,
  _subject_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _name text;
  _role text;
  _new_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.is_super_admin(_uid) THEN
    _role := 'super_admin';
  ELSIF public.has_role(_uid, 'admin') THEN
    _role := 'admin';
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(full_name, email) INTO _name FROM public.profiles WHERE id = _uid;

  INSERT INTO public.activity_logs(
    user_id, user_name, user_role, action_type, target_type, target_id,
    semester_id, subject_id, description
  ) VALUES (
    _uid, _name, _role, _action_type, _target_type, _target_id,
    _semester_id, _subject_id, _description
  ) RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_activity(text, text, text, uuid, uuid, uuid) TO authenticated;
