-- A moderator can mute a member: they keep reading the group but can no longer
-- create, change or delete anything in it. The mute lives apart from
-- user_roles, so leaving the group and joining again does not lift it. Only
-- members with the user role can be muted, and promoting one lifts the mute.
CREATE TABLE public.group_mutes (
    tenant_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
    user_id   uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    muted_by  uuid REFERENCES public.users (id) ON DELETE SET NULL,
    muted_at  timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id)
);

-- The data export lists a user's mutes across all groups.
CREATE INDEX group_mutes_user_id_idx ON public.group_mutes (user_id);
