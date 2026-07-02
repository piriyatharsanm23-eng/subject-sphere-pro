CREATE TABLE IF NOT EXISTS public.telegram_subject_enrollments (
  chat_id bigint NOT NULL,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  semester_id uuid NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, subject_id)
);

GRANT ALL ON public.telegram_subject_enrollments TO service_role;

ALTER TABLE public.telegram_subject_enrollments ENABLE ROW LEVEL SECURITY;

-- No user-facing policies: this table is written/read only by the webhook (service_role).

CREATE INDEX IF NOT EXISTS telegram_subject_enrollments_chat_id_idx
  ON public.telegram_subject_enrollments (chat_id);
CREATE INDEX IF NOT EXISTS telegram_subject_enrollments_semester_id_idx
  ON public.telegram_subject_enrollments (semester_id);