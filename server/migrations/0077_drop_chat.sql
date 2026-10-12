-- The group chat is gone: its messages, the per-group read state that only
-- tracked the chat, its cleanup job and everything that pointed at messages.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cleanup-group-messages';
    END IF;
END;
$$;

DROP FUNCTION public.cleanup_old_group_messages();
DROP TABLE public.group_messages;
DROP TABLE public.user_tenant_state;

DELETE FROM public.reports WHERE report_type = 'message';
DELETE FROM public.user_activity WHERE type = 'message:report';

UPDATE public.groups
SET permissions = permissions - 'send_messages'
WHERE permissions ? 'send_messages';

CREATE OR REPLACE FUNCTION public.cleanup_job_backlog()
    RETURNS TABLE (job text, overdue bigint)
    LANGUAGE sql
    STABLE
    SET search_path TO 'public'
AS $$
    WITH cutoff AS (SELECT now() - interval '12 hours' AS at)
    SELECT backlog.job, backlog.overdue
    FROM cutoff, LATERAL (VALUES
        (1, 'cleanup-refresh-tokens', (
            SELECT count(*) FROM refresh_tokens
            WHERE expires_at < cutoff.at OR revoked_at < cutoff.at - interval '7 days'
        )),
        (2, 'cleanup-mfa-pending', (
            SELECT count(*) FROM mfa_pending_secrets WHERE expires_at < cutoff.at
        )),
        (3, 'cleanup-group-invites', (
            SELECT count(*) FROM group_invites
            WHERE expires_at < cutoff.at - interval '30 days'
               OR used_at < cutoff.at - interval '30 days'
               OR revoked_at < cutoff.at - interval '30 days'
        )),
        (4, 'cleanup-user-activity', (
            SELECT count(*) FROM user_activity WHERE created_at < cutoff.at - interval '30 days'
        )),
        (5, 'cleanup-security-events', (
            SELECT count(*) FROM security_events
            WHERE created_at < cutoff.at - security_events_retention()
        )),
        (6, 'cleanup-unverified-users', (
            SELECT count(*) FROM verifications WHERE expires_at < cutoff.at
        )),
        (7, 'cleanup-password-resets', (
            SELECT count(*) FROM password_resets WHERE created_at < cutoff.at - interval '1 day'
        )),
        (8, 'cleanup-old-items', (
            SELECT count(*) FROM items WHERE due_date < cutoff.at - interval '90 days'
        )),
        (9, 'cleanup-old-schedule-subs', (
            SELECT count(*) FROM schedule_subs sub
            JOIN schedules lesson ON lesson.id = sub.lesson_id
            WHERE schedule_sub_date(sub.week_start, sub.day, lesson.day)
                  < (cutoff.at - interval '90 days')::date
        )),
        (10, 'cleanup-system-announcements', (
            SELECT count(*) FROM system_announcements WHERE ends_at < cutoff.at
        )),
        (11, 'asset-sweep', (
            SELECT CASE
                WHEN EXISTS (
                    SELECT 1 FROM worker_heartbeats
                    WHERE worker = 'asset-sweep' AND succeeded_at > now() - interval '30 minutes'
                ) THEN 0
                ELSE (SELECT count(*) FROM orphaned_assets())
            END
        ))
    ) AS backlog(position, job, overdue)
    ORDER BY backlog.position
$$;
