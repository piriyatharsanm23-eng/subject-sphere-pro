
CREATE TABLE public.telegram_subscribers (
  chat_id bigint PRIMARY KEY,
  username text,
  first_name text,
  is_subscribed boolean NOT NULL DEFAULT true,
  selected_semester_id uuid REFERENCES public.semesters(id) ON DELETE SET NULL,
  selected_subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.telegram_subscribers TO service_role;

ALTER TABLE public.telegram_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can view telegram subscribers"
  ON public.telegram_subscribers FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER telegram_subscribers_updated_at
  BEFORE UPDATE ON public.telegram_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
