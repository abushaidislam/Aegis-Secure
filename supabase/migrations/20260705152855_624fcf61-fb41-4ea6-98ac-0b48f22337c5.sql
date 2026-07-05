
-- Phase 1.1: vault_accounts.tags + GIN index
ALTER TABLE public.vault_accounts
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD CONSTRAINT vault_accounts_tags_length_chk
    CHECK (array_length(tags, 1) IS NULL OR array_length(tags, 1) <= 20);

CREATE INDEX IF NOT EXISTS vault_accounts_tags_gin_idx
  ON public.vault_accounts USING GIN (tags);

-- Phase 1.1: vault_accounts.is_favorite
ALTER TABLE public.vault_accounts
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS vault_accounts_user_favorite_idx
  ON public.vault_accounts (user_id, is_favorite) WHERE is_favorite;

-- Phase 1.1: feature_flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read feature flags"
  ON public.feature_flags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert feature flags"
  ON public.feature_flags FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update feature flags"
  ON public.feature_flags FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete feature flags"
  ON public.feature_flags FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER feature_flags_touch_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Phase 1.1: announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  kind text NOT NULL DEFAULT 'info' CHECK (kind IN ('info','warning','success','critical')),
  dismissable boolean NOT NULL DEFAULT true,
  audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

GRANT SELECT ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read active announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (expires_at IS NULL OR expires_at > now());

CREATE POLICY "Admins can insert announcements"
  ON public.announcements FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update announcements"
  ON public.announcements FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete announcements"
  ON public.announcements FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS announcements_expires_at_idx
  ON public.announcements (expires_at);

-- Phase 1.2: per-user insert rate limit on vault_accounts
CREATE OR REPLACE FUNCTION public.enforce_vault_accounts_insert_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent integer;
BEGIN
  SELECT count(*) INTO recent
  FROM public.vault_accounts
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '1 minute';
  IF recent >= 60 THEN
    RAISE EXCEPTION 'Rate limit: no more than 60 new vault accounts per minute.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_vault_accounts_insert_rate_limit()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_vault_accounts_insert_rate_limit_trg ON public.vault_accounts;
CREATE TRIGGER enforce_vault_accounts_insert_rate_limit_trg
  BEFORE INSERT ON public.vault_accounts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_vault_accounts_insert_rate_limit();
