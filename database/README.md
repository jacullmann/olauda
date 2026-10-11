# Database: PostgreSQL 18 + pg_cron

This directory contains the custom Postgres image and the cleanup setup for the
application. Database maintenance (expired tokens and invites, expired MFA
pendings, and the retention periods promised in the privacy policy) runs via
**pg_cron** *inside* the database — deliberately decoupled from the application
process.

**Why not in the app code?** The deploy pipeline (GitHub Actions -> Coolify
webhook) restarts the app container on every deploy, which resets in-memory
timers (`tokio::interval`). Cleanup jobs with multi-hour intervals would
therefore almost never fire. pg_cron runs in the DB container and is unaffected.

---

## Architecture

| Item            | Value                                                       |
|-----------------|-------------------------------------------------------------|
| Base image      | `postgres:18` + `postgresql-18-cron` (see `Dockerfile`)     |
| Registry        | `ghcr.io/jacullmann/olauda-database`                          |
| Target database | `postgres` (the app uses the default DB, no separate one)   |
| DB user         | `postgres`                                                  |
| Schedule        | every 6h, staggered (see `pg_cron_setup.sql`)               |
| Retention       | see the job table below                                     |

### Jobs

| Job (`jobname`)                | Function                                 | Deletes                                         |
|--------------------------------|------------------------------------------|-------------------------------------------------|
| `cleanup-refresh-tokens`       | `cleanup_expired_refresh_tokens()`       | expired tokens, revoked ones after 7 days       |
| `cleanup-mfa-pending`          | `cleanup_expired_mfa_pending()`          | expired 2FA setups                              |
| `cleanup-group-messages`       | `cleanup_old_group_messages()`           | chat messages older than 7 days                 |
| `cleanup-group-invites`        | `cleanup_expired_group_invites()`        | invites 30 days after expiry, use or revocation |
| `cleanup-user-activity`        | `cleanup_old_user_activity()`            | activity log older than 30 days                 |
| `cleanup-security-events`      | `cleanup_old_security_events()`          | security events older than 90 days              |
| `cleanup-unverified-users`     | `cleanup_unverified_users()`             | sign-ups unconfirmed after 2 days               |
| `cleanup-password-resets`      | `cleanup_expired_password_resets()`      | password reset/setup codes after 24 hours       |
| `cleanup-old-items`            | `cleanup_old_items()`                    | tasks 90 days after their due date              |
| `cleanup-system-announcements` | `cleanup_expired_system_announcements()` | platform announcements once they end            |

Files in Cloudinary are outside the database's reach, so the server cleans
them up itself. Uploads go through the server, which records every file in
`assets` before it uploads it, and every 5 minutes deletes recorded files that
neither a task attachment (`item_attachments`), a group picture nor a
document's preview has referenced for a day (`orphaned_assets()`). The superadmin overview shows, per job, how many rows
it should already have removed (`cleanup_job_backlog()`); anything above zero
means the job is not running.

### Files
- `Dockerfile` — Postgres 18 with pg_cron, built by GitHub Actions.
- `pg_cron_setup.sql` — one-time scheduling (`CREATE EXTENSION` + `cron.schedule`).
- The cleanup **functions** are created by the app migrations
  (`server/migrations/0006_consolidate_cleanup.sql`, `0012_…`,
  `0040_scheduled_retention.sql`, `0041_delete_items_after_due_date.sql` and
  `0050_limit_email_codes_per_address.sql`, `0051_system_announcements.sql`,
  `0063_pending_sign_ups.sql` and `0072_security_audit_log.sql`),
  not here.

`security_events` is the security audit log and is append-only: a trigger
rejects every `UPDATE`, and a `DELETE` of any row younger than
`security_events_retention()` (90 days), so only the cleanup job removes rows.
Removing a younger row by hand, e.g. for an erasure request, takes a
deliberate `ALTER TABLE security_events DISABLE TRIGGER
security_events_retention_only_delete` as the table owner.

The superadmin log shows `security_events` and `user_activity` as one
timeline through the read-only `event_log` view
(`0075_event_log.sql`); each table keeps its own retention.

---

## Bootstrap (setting up the environment from scratch)

These steps are **one-time per environment** and run manually. Reason: two of
them touch the persistent data volume / the Coolify UI and cannot be enforced
via the image or CI. Follow the order exactly.

### 1. Build the image
Commit and push `database/**` -> the `deploy-database.yaml` workflow builds the
image and pushes it to GHCR (tags `latest`, `18`, `sha-<commit>`). No manual
`docker build`.

### 2. Set the image in Coolify
In Coolify, on the DB resource (`db-prod`) -> **General** -> **Image**, set an
immutable tag:
```
ghcr.io/jacullmann/olauda-database:sha-<commit>
```
Then start/deploy. The data volume is preserved.

> **If a name conflict appears when swapping the image**
> (`Conflict. The container name "..." is already in use`): remove the stale
> container from the **server terminal** (not the DB terminal), then start again
> in Coolify:
> ```bash
> docker rm -f <container-id-or-name-from-the-error>
> ```

### 3. Enable pg_cron in `postgresql.conf`
Coolify's "Custom PostgreSQL Configuration" field has a bug in v4 (input
disappears / container becomes unhealthy). So write the config directly into the
real `postgresql.conf` in the data volume. **Do not guess the path** — on PG18
it is not under `/var/lib/postgresql/data`. Resolve it dynamically.

In the **DB container terminal**:
```bash
CF=$(psql -U postgres -tA -c "SHOW config_file;")
echo "Config: $CF"
echo "shared_preload_libraries = 'pg_cron'" >> "$CF"
echo "cron.database_name = 'postgres'"       >> "$CF"
tail -n 5 "$CF"   # verify
```
Leave the Coolify field **empty** — otherwise Coolify starts Postgres with
`-c config_file=...` pointing at a different file and ignores these lines.

### 4. Restart the DB
In Coolify, **Restart** the DB resource (not just reload —
`shared_preload_libraries` requires a full restart). Then check:
```bash
psql -U postgres -c "SHOW shared_preload_libraries;"   # must show pg_cron
```

### 5. Apply the migration (create functions) — BEFORE scheduling
The cleanup functions must exist before the cron jobs call them.
`sqlx::migrate!` embeds migrations at **compile time**, so rebuild and deploy
the `server` image (push to `server/**`). On startup the server applies
the migrations, creating the functions listed in the job table above.

> If you schedule the jobs *before* the migration, they run into nothing and
> report `failed` until the functions exist.

### 6. Activate scheduling
In the **DB container terminal**, run the contents of `pg_cron_setup.sql`:
```bash
psql -U postgres -d postgres
```
Then paste the SQL (or pipe it in). The jobs are created idempotently by
their `jobname` — re-running updates them instead of creating duplicates, so
after adding jobs you can simply run the whole file again.

---

## Verification

```sql
-- Scheduled jobs (expect ten cleanup-*, active = true)
SELECT jobid, schedule, command, database, active, jobname FROM cron.job;

-- Functions present? (all ten cleanup_* must be listed)
\df cleanup_*

-- Run history (status should be 'succeeded', not 'failed')
SELECT jobname, status, return_message, start_time, end_time
FROM cron.job_run_details
ORDER BY start_time DESC LIMIT 20;
```

A single job can be triggered manually for testing:
```sql
SELECT public.cleanup_expired_refresh_tokens();
SELECT public.cleanup_expired_mfa_pending();
SELECT public.cleanup_old_group_messages();

-- Rows each job should already have removed (all 0 when healthy)
SELECT * FROM public.cleanup_job_backlog();
```

---

## Maintenance

- **PG major upgrade (e.g. 18 -> 19):** in the `Dockerfile`, bump
  `FROM postgres:NN` and the `postgresql-NN-cron` package, and the
  `type=raw,value=NN` tag in the workflow. Then redo steps 1-2 (new image), and
  3-4 if the data volume was re-initialized.
- **Change retention/interval:** adjust the cron expressions in
  `pg_cron_setup.sql` and re-run (idempotent). The retention logic itself lives
  in the functions -> change it via a new migration.
- **Pause a job:** `SELECT cron.unschedule('cleanup-group-messages');`
- **Once after migration 0043:** clients used to upload straight to
  Cloudinary, where the server could not check what arrived. In the Media
  Library, filter the deployment's folder by type *video* and delete anything
  listed; images and raw files nothing references are removed by the sweep.
