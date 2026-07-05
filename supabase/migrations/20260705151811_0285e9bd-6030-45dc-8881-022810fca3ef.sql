
-- Trigger + maintenance functions should not be directly callable.
REVOKE ALL ON FUNCTION public.purge_old_client_errors(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_vault_accounts_per_user_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_role_self_promotion() FROM PUBLIC, anon, authenticated;

-- is_admin is used inside RLS policies for authenticated users; keep that grant explicit.
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
