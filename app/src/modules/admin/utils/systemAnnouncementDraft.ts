import { ANNOUNCEMENT_MAX_CHARS } from '@/modules/announcements/types';
import { addDays, isoDate } from '@/modules/schedule/utils/weekday';
import { formatTimeOfDay } from '@/utils/time';
import type {
  AdminSystemAnnouncement,
  SaveSystemAnnouncementRequest,
} from '../types';

/** The form's state, with dates and times in local time as the inputs hold them. */
export interface SystemAnnouncementDraft {
  content: string;
  important: boolean;
  /** Off publishes right away. */
  scheduled: boolean;
  startDate: string;
  startTime: string;
  /** Off shows the announcement until it is deleted. */
  expires: boolean;
  endDate: string;
  endTime: string;
}

export type DraftField = 'content' | 'start' | 'end';

export type DraftError =
  | 'text_missing'
  | 'text_too_long'
  | 'date_missing'
  | 'start_in_past'
  | 'end_before_start';

export type DraftResult =
  | { ok: true; request: SaveSystemAnnouncementRequest }
  | { ok: false; field: DraftField; error: DraftError };

const localTime = (date: Date) =>
  formatTimeOfDay(date.getHours() * 60 + date.getMinutes());

/** The moment the date and time inputs name, or `null` while either is unset. */
function localMoment(date: string, time: string): Date | null {
  if (!date || !time) return null;
  // A date-time without an offset is read in local time.
  const moment = new Date(`${date}T${time}`);
  return Number.isNaN(moment.getTime()) ? null : moment;
}

function nextFullHour(now: Date): Date {
  const next = new Date(now);
  next.setHours(now.getHours() + 1, 0, 0, 0);
  return next;
}

/**
 * Only scheduled announcements can be edited, so an existing one opens as
 * scheduled. A new one proposes the next full hour as its start and a week
 * later as its end, for when either is switched on.
 */
export function draftFrom(
  announcement: AdminSystemAnnouncement | null,
  now: Date,
): SystemAnnouncementDraft {
  const start = announcement
    ? new Date(announcement.startsAt)
    : nextFullHour(now);
  const end = announcement?.endsAt
    ? new Date(announcement.endsAt)
    : addDays(start, 7);

  return {
    content: announcement?.content ?? '',
    important: announcement?.important ?? false,
    scheduled: announcement !== null,
    startDate: isoDate(start),
    startTime: localTime(start),
    expires: Boolean(announcement?.endsAt),
    endDate: isoDate(end),
    endTime: localTime(end),
  };
}

export function toSaveRequest(
  draft: SystemAnnouncementDraft,
  now: Date,
): DraftResult {
  const content = draft.content.trim();
  if (!content) return { ok: false, field: 'content', error: 'text_missing' };
  // Counted in code points, as the server counts characters.
  if ([...content].length > ANNOUNCEMENT_MAX_CHARS) {
    return { ok: false, field: 'content', error: 'text_too_long' };
  }

  const request: SaveSystemAnnouncementRequest = {
    content,
    important: draft.important,
  };

  let start = now;
  if (draft.scheduled) {
    const moment = localMoment(draft.startDate, draft.startTime);
    if (!moment) return { ok: false, field: 'start', error: 'date_missing' };
    if (moment <= now) {
      return { ok: false, field: 'start', error: 'start_in_past' };
    }
    start = moment;
    request.startsAt = moment.toISOString();
  }

  if (draft.expires) {
    const moment = localMoment(draft.endDate, draft.endTime);
    if (!moment) return { ok: false, field: 'end', error: 'date_missing' };
    if (moment <= start) {
      return { ok: false, field: 'end', error: 'end_before_start' };
    }
    request.endsAt = moment.toISOString();
  }

  return { ok: true, request };
}
