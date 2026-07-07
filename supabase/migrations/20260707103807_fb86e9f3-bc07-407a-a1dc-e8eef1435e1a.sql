
-- Attribute Semester 4 uploads to Piriyatharsan (data importer / super admin)
UPDATE public.materials
SET uploaded_by = '66d173c7-06ef-4176-9ccd-5936e343f670'
WHERE semester_id = '0ceeab7f-7bba-4a23-a425-13b07f5ffbdc'
  AND uploaded_by IS NULL;

-- Show Piriyatharsan as an admin contributor for Semester 4 on the Contributors page
INSERT INTO public.user_roles (user_id, role, assigned_semester_id)
VALUES ('66d173c7-06ef-4176-9ccd-5936e343f670', 'admin', '0ceeab7f-7bba-4a23-a425-13b07f5ffbdc')
ON CONFLICT DO NOTHING;
