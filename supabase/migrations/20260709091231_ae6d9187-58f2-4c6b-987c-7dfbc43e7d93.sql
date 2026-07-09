-- Phase 13.1: vault sharing foundation
-- ============================================================================
-- 1. Rate-limit helper table for email lookups (privacy: prevent enumeration)
-- ============================================================================
CREATE TABLE public.share_lookup_attempts (
  caller_user_id uuid NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.share_lookup_attempts TO authenticated;
GRANT ALL ON public.share_lookup_attempts TO service_role;
ALTER TABLE public.share_lookup_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no direct client access to share_lookup_attempts"
  ON public.share_lookup_attempts FOR ALL
  USING (false) WITH CHECK (false);
CREATE INDEX share_lookup_attempts_caller_time_idx
  ON public.share_lookup_attempts (caller_user_id, attempted_at DESC);

-- ============================================================================
-- 2. user_public_keys — X25519 (wrap) + Ed25519 (sign) keypairs per user
-- ============================================================================
CREATE TABLE public.user_public_keys (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  x25519_public_key   bytea NOT NULL,
  ed25519_public_key  bytea NOT NULL,
  x25519_private_wrapped   bytea NOT NULL,
  x25519_private_wrapped_iv bytea NOT NULL,
  ed25519_private_wrapped  bytea NOT NULL,
  ed25519_private_wrapped_iv bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_public_keys_x25519_pub_size CHECK (octet_length(x25519_public_key) = 32),
  CONSTRAINT user_public_keys_ed25519_pub_size CHECK (octet_length(ed25519_public_key) = 32),
  CONSTRAINT user_public_keys_wrap_iv_x_size CHECK (octet_length(x25519_private_wrapped_iv) = 12),
  CONSTRAINT user_public_keys_wrap_iv_e_size CHECK (octet_length(ed25519_private_wrapped_iv) = 12),
  CONSTRAINT user_public_keys_wrap_x_size CHECK (octet_length(x25519_private_wrapped) <= 128),
  CONSTRAINT user_public_keys_wrap_e_size CHECK (octet_length(ed25519_private_wrapped) <= 128)
);
GRANT SELECT, INSERT, UPDATE ON public.user_public_keys TO authenticated;
GRANT ALL ON public.user_public_keys TO service_role;
ALTER TABLE public.user_public_keys ENABLE ROW LEVEL SECURITY;

-- Public keys are readable by any authenticated user (they need each other's
-- public keys to seal shares). Private-key columns are still ciphertext, so
-- exposure is limited to the public halves + opaque wrapped blobs.
CREATE POLICY "authenticated users can read any user_public_keys"
  ON public.user_public_keys FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "users can insert their own user_public_keys"
  ON public.user_public_keys FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users can update their own user_public_keys"
  ON public.user_public_keys FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_public_keys_updated_at
  BEFORE UPDATE ON public.user_public_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 3. vault_shares — per-account share to a recipient
-- ============================================================================
CREATE TABLE public.vault_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.vault_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  recipient_user_id uuid NOT NULL,
  -- Sealed-box: ephemeral X25519 pub + AES-GCM(iv, secret + counter, AAD)
  ephemeral_public_key bytea NOT NULL,
  sealed_ciphertext bytea NOT NULL,
  sealed_iv bytea NOT NULL,
  -- Plaintext context copied at share time so recipient sees issuer/label
  -- without needing to read the owner's vault_accounts row.
  issuer_snapshot text NOT NULL DEFAULT '',
  label_snapshot text NOT NULL DEFAULT '',
  algorithm_snapshot text NOT NULL DEFAULT 'SHA1',
  digits_snapshot integer NOT NULL DEFAULT 6,
  period_snapshot integer NOT NULL DEFAULT 30,
  otp_type_snapshot text NOT NULL DEFAULT 'totp',
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_shares_ephemeral_size CHECK (octet_length(ephemeral_public_key) = 32),
  CONSTRAINT vault_shares_iv_size CHECK (octet_length(sealed_iv) = 12),
  CONSTRAINT vault_shares_ct_size CHECK (octet_length(sealed_ciphertext) <= 512),
  CONSTRAINT vault_shares_owner_ne_recipient CHECK (owner_user_id <> recipient_user_id),
  CONSTRAINT vault_shares_unique_active UNIQUE (account_id, recipient_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_shares TO authenticated;
GRANT ALL ON public.vault_shares TO service_role;
ALTER TABLE public.vault_shares ENABLE ROW LEVEL SECURITY;

CREATE INDEX vault_shares_owner_idx ON public.vault_shares (owner_user_id, created_at DESC);
CREATE INDEX vault_shares_recipient_idx
  ON public.vault_shares (recipient_user_id, created_at DESC)
  WHERE revoked_at IS NULL;
CREATE INDEX vault_shares_account_idx ON public.vault_shares (account_id);

-- Owners see everything about their shares. Recipients only see live ones.
CREATE POLICY "owner sees own shares"
  ON public.vault_shares FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id);
CREATE POLICY "recipient sees non-revoked shares"
  ON public.vault_shares FOR SELECT TO authenticated
  USING (auth.uid() = recipient_user_id AND revoked_at IS NULL);
CREATE POLICY "owner inserts shares for own accounts"
  ON public.vault_shares FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.vault_accounts a
      WHERE a.id = account_id AND a.user_id = auth.uid()
    )
  );
CREATE POLICY "owner updates own shares"
  ON public.vault_shares FOR UPDATE TO authenticated
  USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "owner deletes own shares"
  ON public.vault_shares FOR DELETE TO authenticated
  USING (auth.uid() = owner_user_id);

CREATE TRIGGER vault_shares_updated_at
  BEFORE UPDATE ON public.vault_shares
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 4. needs_rotation flag on vault_accounts (set on revoke)
-- ============================================================================
ALTER TABLE public.vault_accounts
  ADD COLUMN needs_rotation boolean NOT NULL DEFAULT false;

-- ============================================================================
-- 5. find_user_by_email RPC — rate-limited enumeration surface
-- ============================================================================
CREATE OR REPLACE FUNCTION public.find_user_by_email(_email text)
RETURNS TABLE (
  user_id uuid,
  x25519_public_key bytea,
  ed25519_public_key bytea
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid;
  recent_count integer;
  normalized text;
  target_id uuid;
BEGIN
  caller := auth.uid();
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Rate limit: 30 lookups per minute per caller.
  SELECT count(*) INTO recent_count
    FROM public.share_lookup_attempts
   WHERE caller_user_id = caller
     AND attempted_at > now() - interval '1 minute';
  IF recent_count >= 30 THEN
    RAISE EXCEPTION 'Rate limit exceeded: too many lookups. Try again shortly.'
      USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.share_lookup_attempts (caller_user_id) VALUES (caller);

  normalized := lower(trim(_email));
  IF normalized = '' THEN
    RETURN;
  END IF;

  -- Resolve email via auth.users, but only return keys if the user has
  -- published their sharing pubkeys (opts them into the flow implicitly).
  SELECT u.id INTO target_id FROM auth.users u WHERE lower(u.email) = normalized LIMIT 1;
  IF target_id IS NULL OR target_id = caller THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT k.user_id, k.x25519_public_key, k.ed25519_public_key
      FROM public.user_public_keys k
     WHERE k.user_id = target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.find_user_by_email(text) FROM public;
GRANT EXECUTE ON FUNCTION public.find_user_by_email(text) TO authenticated;

-- ============================================================================
-- 6. Purge job helper for the rate-limit log (optional; harmless if unused)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.purge_old_share_lookup_attempts(minutes integer DEFAULT 60)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted integer;
BEGIN
  DELETE FROM public.share_lookup_attempts
   WHERE attempted_at < now() - make_interval(mins => minutes);
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;