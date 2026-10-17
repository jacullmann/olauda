import type { AnnouncementDto, SystemAnnouncementDto } from '@/api/schema';

/** An announcement to the members of one group. */
export type Announcement = AnnouncementDto;

/**
 * An announcement from the platform to every user. The server only sends
 * those the user has yet to read: once read, it is shown nowhere.
 */
export type SystemAnnouncement = SystemAnnouncementDto;

/** Who an announcement was posted to: one group, or every user. */
export type AnnouncementScope = 'group' | 'system';

/** An announcement as the app shows it, whichever audience it was posted to. */
export interface FeedAnnouncement {
  scope: AnnouncementScope;
  id: string;
  content: string;
  important: boolean;
  publishedAt: string;
  read: boolean;
}

/** Mirrors the backend's limit: as short as an SMS. */
export const ANNOUNCEMENT_MAX_CHARS = 160;
