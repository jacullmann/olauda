import { computed } from 'vue';
import { useAnnouncementStore } from '@/modules/announcements/stores/useAnnouncementStore';
import { useSystemAnnouncementStore } from '@/modules/announcements/stores/useSystemAnnouncementStore';
import type {
  Announcement,
  FeedAnnouncement,
  SystemAnnouncement,
} from '@/modules/announcements/types';

export function fromGroupAnnouncement(a: Announcement): FeedAnnouncement {
  return {
    scope: 'group',
    id: a.id,
    content: a.content,
    important: a.important,
    publishedAt: a.createdAt,
    read: a.read,
  };
}

function fromSystemAnnouncement(a: SystemAnnouncement): FeedAnnouncement {
  return {
    scope: 'system',
    id: a.id,
    content: a.content,
    important: a.important,
    publishedAt: a.publishedAt,
    read: false,
  };
}

/**
 * The announcements a user sees. Unread ones show in the card: the
 * platform's, on every page, ahead of those of the group on screen, as they
 * concern everyone, whichever group is open. Only the group's stay listed
 * once read.
 */
export function useAnnouncementFeed() {
  const groupStore = useAnnouncementStore();
  const systemStore = useSystemAnnouncementStore();

  const systemAnnouncements = computed(() =>
    systemStore.announcements.map(fromSystemAnnouncement),
  );

  const groupAnnouncements = computed(() =>
    groupStore.announcements.map(fromGroupAnnouncement),
  );

  const unread = computed(() => [
    ...systemAnnouncements.value,
    ...groupAnnouncements.value.filter((a) => !a.read),
  ]);

  function acknowledge(announcement: FeedAnnouncement) {
    const store = announcement.scope === 'system' ? systemStore : groupStore;
    return store.markRead([announcement.id]);
  }

  async function acknowledgeAll() {
    await Promise.all([systemStore.markAllRead(), groupStore.markAllRead()]);
  }

  return {
    groupAnnouncements,
    unread,
    acknowledge,
    acknowledgeAll,
  };
}
