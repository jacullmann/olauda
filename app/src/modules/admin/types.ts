import type {
  AccessControls as AccessControlsDto,
  AccountSecurityDto,
  AdminGroupDto,
  AdminSystemAnnouncementDto,
  AdminUserDto,
  CleanupJobDto,
  DailyActivityDto,
  EmailActivityDto,
  EmailQuotaDto,
  EventLogEntryDto,
  Outcome,
  ReportDto,
  SaveSystemAnnouncementDto,
  ServerMetricsDto,
  StatsDto,
  UserMembershipDto,
  WeeklyRhythmDto,
  operations,
} from '@/api/schema';

export type {
  EventSource,
  MemberRole,
  MetricPoint,
  SystemAnnouncementStatus,
} from '@/api/schema';

export type AdminTab =
  'overview' | 'directory' | 'log' | 'reports' | 'announcements';

export type SortOrder = 'asc' | 'desc';

/** The rows of a list from an offset on, with how many match in all. */
export interface ListWindow<T> {
  items: T[];
  total: number;
}

export type AdminStats = StatsDto;

/** A scheduled cleanup, named as in `database/pg_cron_setup.sql`, with the
 * rows it should already have removed. */
export type CleanupJob = CleanupJobDto;

export type EventOutcome = Outcome;

/** An entry of the security or the activity log. Security events outlive the
 * accounts and groups they name; the email or group name is there only while
 * those exist. Activity is caused by the account it belongs to and records no
 * outcome, address or group. */
export type EventLogEntry = EventLogEntryDto;

/** The log's filters as the API takes them; the cursor is the page's own. */
export type EventLogQuery = Omit<
  NonNullable<operations['get_events']['parameters']['query']>,
  'cursor'
>;

export type DailyActivity = DailyActivityDto;

/** Users per hour of the week, in German local time, summed over `weeks`. */
export type WeeklyRhythm = WeeklyRhythmDto;

export type DailyMetric = Exclude<keyof DailyActivity, 'day'>;

/** Every account split by how it is secured and how it signs in. Each
 * breakdown's parts add up to all accounts. */
export type AccountSecurity = AccountSecurityDto;

/** Emails Resend sent per UTC day over the daily activity's days, and what
 * became of them; emails still on their way have no outcome yet. */
export type EmailActivity = EmailActivityDto;

/** Emails used in the current month of the Resend plan. */
export type EmailQuota = EmailQuotaDto;

export type MetricsRange =
  operations['get_server_metrics']['parameters']['query']['range'];

/** The server's load as Hetzner measures it. CPU is in percent of one vCPU,
 * so it reaches `cpuCores * 100`; bandwidths are in bytes per second. */
export type ServerMetrics = ServerMetricsDto;

export type AdminUserListQuery = NonNullable<
  operations['list_admin_users']['parameters']['query']
>;

export type UserStatusFilter = NonNullable<AdminUserListQuery['status']>;

export type UserSort = NonNullable<AdminUserListQuery['sort']>;

export type AdminUser = AdminUserDto;

export type AdminMembership = UserMembershipDto;

export type AdminReport = ReportDto;

export type AdminGroupListQuery = NonNullable<
  operations['list_admin_groups']['parameters']['query']
>;

export type GroupTypeFilter = NonNullable<AdminGroupListQuery['type']>;

export type GroupSort = NonNullable<AdminGroupListQuery['sort']>;

export type AdminGroup = AdminGroupDto;

/** A platform announcement that runs or is scheduled; ended ones are gone. */
export type AdminSystemAnnouncement = AdminSystemAnnouncementDto;

/** Omitting `startsAt` publishes right away; omitting `endsAt` never ends. */
export type SaveSystemAnnouncementRequest = SaveSystemAnnouncementDto;

export interface AdminNavItem {
  id: AdminTab;
  name: string;
  label: string;
}

/** The platform-wide switches, as superadmins manage them. */
export type AccessControls = AccessControlsDto;

export type AccessControlSwitch = keyof AccessControls;
