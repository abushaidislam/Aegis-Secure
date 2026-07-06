
-- Phase 9.1: trusted devices
CREATE TABLE IF NOT EXISTS public.user_sessions_meta (
  session_id       uuid PRIMARY KEY,
  user_id          uuid NOT NULL,
  user_agent       text NOT NULL DEFAULT '',
  device_label     text NOT NULL DEFAULT 'Unknown device',
  coarse_country   text,
  coarse_region    text,
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz NOT NULL DEFAULT now()
);

-- Users may only read their own device rows. All writes are server-only
-- (service_role) via the trusted-devices server functions.
GRANT SELECT ON public.user_sessions_meta TO authenticated;
GRANT ALL    ON public.user_sessions_meta TO service_role;

ALTER TABLE public.user_sessions_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own device sessions"
  ON public.user_sessions_meta FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_sessions_meta_user_last_seen_idx
  ON public.user_sessions_meta (user_id, last_seen_at DESC);

-- Audit every insert / delete to admin_audit. SECURITY DEFINER so the
-- trigger can write to admin_audit even though only service_role has
-- INSERT there; the function's search_path is pinned.
CREATE OR REPLACE FUNCTION public.log_user_sessions_meta_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.admin_audit (actor_user_id, action, target, metadata)
    VALUES (
      NEW.user_id,
      'device_session.first_seen',
      NEW.session_id::text,
      jsonb_build_object(
        'device_label', NEW.device_label,
        'coarse_country', NEW.coarse_country,
        'coarse_region', NEW.coarse_region
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.admin_audit (actor_user_id, action, target, metadata)
    VALUES (
      OLD.user_id,
      'device_session.revoked',
      OLD.session_id::text,
      jsonb_build_object(
        'device_label', OLD.device_label,
        'coarse_country', OLD.coarse_country
      )
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_user_sessions_meta_audit_ins
AFTER INSERT ON public.user_sessions_meta
FOR EACH ROW EXECUTE FUNCTION public.log_user_sessions_meta_change();

CREATE TRIGGER trg_user_sessions_meta_audit_del
AFTER DELETE ON public.user_sessions_meta
FOR EACH ROW EXECUTE FUNCTION public.log_user_sessions_meta_change();
