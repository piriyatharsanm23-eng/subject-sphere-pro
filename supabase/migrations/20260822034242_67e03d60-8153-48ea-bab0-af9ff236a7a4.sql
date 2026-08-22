ALTER VIEW public.public_contributors SET (security_invoker = false);
GRANT SELECT ON public.public_contributors TO anon, authenticated;