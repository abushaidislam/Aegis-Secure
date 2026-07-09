CREATE POLICY "Invitee can join family with pending invite"
ON public.family_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'member'
  AND EXISTS (
    SELECT 1 FROM public.family_invites i
    WHERE i.family_id = family_members.family_id
      AND lower(i.email) = public.current_user_email()
      AND i.status = 'pending'
      AND i.expires_at > now()
  )
);