
-- Fix 1: emergency_contacts — move "request access" into a SECURITY DEFINER RPC
-- so the grantee cannot bypass the waiting period by writing requested_at /
-- wait_days directly.
DROP POLICY IF EXISTS "Grantee requests emergency access" ON public.emergency_contacts;

CREATE OR REPLACE FUNCTION public.request_emergency_access(_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  UPDATE public.emergency_contacts
     SET status = 'requested',
         requested_at = now(),
         approved_at = NULL
   WHERE id = _contact_id
     AND grantee_id = auth.uid()
     AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active grant to request' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.request_emergency_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_emergency_access(uuid) TO authenticated;

-- Fix 2: family_invites — invitee UPDATE must only allow the pending →
-- accepted / declined / expired transitions. Prevents self-reinstating a
-- revoked / declined / expired invite back to pending.
DROP POLICY IF EXISTS "Invitee can update their invite (accept/decline)" ON public.family_invites;

CREATE POLICY "Invitee can update their invite (accept/decline)"
ON public.family_invites
FOR UPDATE
TO authenticated
USING (
  lower(email) = current_user_email()
  AND status = 'pending'
)
WITH CHECK (
  lower(email) = current_user_email()
  AND status IN ('accepted', 'declined', 'expired')
);
