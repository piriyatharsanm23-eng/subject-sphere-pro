REVOKE EXECUTE ON FUNCTION public.notify_admins_on_feedback() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admins_on_module_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admins_on_student_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_public_profile_info() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_activity_log_metadata() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_module_request_accept() FROM PUBLIC, anon, authenticated;