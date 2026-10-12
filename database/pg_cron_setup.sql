CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
               'cleanup-refresh-tokens',
               '0 */6 * * *',
               $$SELECT public.cleanup_expired_refresh_tokens()$$
       );

SELECT cron.schedule(
               'cleanup-mfa-pending',
               '15 */6 * * *',
               $$SELECT public.cleanup_expired_mfa_pending()$$
       );

SELECT cron.schedule(
               'cleanup-group-invites',
               '45 */6 * * *',
               $$SELECT public.cleanup_expired_group_invites()$$
       );

SELECT cron.schedule(
               'cleanup-user-activity',
               '5 */6 * * *',
               $$SELECT public.cleanup_old_user_activity()$$
       );

SELECT cron.schedule(
               'cleanup-security-events',
               '20 */6 * * *',
               $$SELECT public.cleanup_old_security_events()$$
       );

SELECT cron.schedule(
               'cleanup-unverified-users',
               '35 */6 * * *',
               $$SELECT public.cleanup_unverified_users()$$
       );

SELECT cron.schedule(
               'cleanup-password-resets',
               '10 */6 * * *',
               $$SELECT public.cleanup_expired_password_resets()$$
       );

SELECT cron.schedule(
               'cleanup-old-items',
               '50 */6 * * *',
               $$SELECT public.cleanup_old_items()$$
       );

SELECT cron.schedule(
               'cleanup-old-schedule-subs',
               '40 */6 * * *',
               $$SELECT public.cleanup_old_schedule_subs()$$
       );

SELECT cron.schedule(
               'cleanup-system-announcements',
               '25 */6 * * *',
               $$SELECT public.cleanup_expired_system_announcements()$$
       );
