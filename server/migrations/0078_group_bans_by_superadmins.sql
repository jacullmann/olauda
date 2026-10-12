-- A superadmin can suspend a whole group without deleting it. Members keep
-- their memberships and content, but no request reaches the group until the
-- suspension is lifted. A column rather than a table: it is read by the tenant
-- check on every group request, which already selects the group's row.
ALTER TABLE public.groups
    ADD COLUMN banned_at timestamp with time zone;

COMMENT ON COLUMN public.groups.banned_at IS
    'Set while a superadmin has banned the group; members cannot open it.';
