-- Defense in depth: AI explanations are written only by the trusted server (service role).
-- Remove any write privileges from client-facing roles so PostgREST rejects writes
-- at the privilege layer, in addition to RLS having no INSERT/UPDATE/DELETE policy.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON public.ai_explanations FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON public.ai_explanations FROM authenticated;
REVOKE ALL ON public.ai_explanations FROM PUBLIC;

GRANT SELECT ON public.ai_explanations TO authenticated;
GRANT ALL ON public.ai_explanations TO service_role;