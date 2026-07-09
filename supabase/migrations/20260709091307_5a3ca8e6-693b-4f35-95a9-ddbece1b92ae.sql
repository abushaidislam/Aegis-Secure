-- Tighten new maintenance function: service-role only.
REVOKE ALL ON FUNCTION public.purge_old_share_lookup_attempts(integer) FROM public;
REVOKE ALL ON FUNCTION public.purge_old_share_lookup_attempts(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_share_lookup_attempts(integer) TO service_role;