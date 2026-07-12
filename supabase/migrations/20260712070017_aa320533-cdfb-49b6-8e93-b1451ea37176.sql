REVOKE EXECUTE ON FUNCTION public.request_emergency_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_emergency_access(uuid) TO authenticated;