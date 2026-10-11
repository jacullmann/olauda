-- The superadmin log shows the security audit log and the activity log as one
-- timeline. The view gives both the same shape, so every filter, the search
-- and the paging are written once against it, while each table keeps its own
-- retention and rules. Postgres pushes filters, ORDER BY and LIMIT into both
-- branches of the UNION ALL and merges their index scans.
--
-- Activity is always caused by the account it belongs to, so that account is
-- its subject and its actor alike. It records no address, outcome or group.

CREATE VIEW public.event_log AS
SELECT e.id,
       'security'::text AS source,
       e.event_type::text AS type,
       e.outcome::text AS outcome,
       e.user_id,
       e.actor_id,
       e.tenant_id AS group_id,
       e.ip_address,
       e.user_agent,
       e.metadata,
       e.created_at
FROM public.security_events e
UNION ALL
SELECT a.id,
       'activity'::text,
       a.type,
       NULL::text,
       a.user_id,
       a.user_id,
       NULL::uuid,
       NULL::inet,
       NULL::text,
       COALESCE(a.meta, '{}'::jsonb),
       a.created_at
FROM public.user_activity a;

COMMENT ON VIEW public.event_log IS
    'security_events and user_activity as one timeline for the superadmin log.';

-- The log is paged by (created_at, id) in both directions; one index per table
-- serves either direction and replaces the one on created_at alone.
CREATE INDEX idx_security_events_created_id ON public.security_events (created_at, id);
CREATE INDEX idx_user_activity_created_id ON public.user_activity (created_at, id);
DROP INDEX public.idx_security_events_created_at;
DROP INDEX public.idx_user_activity_created_at;
