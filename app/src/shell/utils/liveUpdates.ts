import type { InvalidateQueryFilters } from '@tanstack/vue-query';
import type {
  AccountTopic,
  Event as LiveEvent,
  GroupTopic,
  PlatformTopic,
} from '@/api/schema';
import { accountKeys } from '@/modules/account/utils/accountQueries';
import { adminKeys } from '@/modules/admin/utils/adminQueries';
import { announcementKeys } from '@/modules/announcements/utils/announcementQueries';
import { sessionKey } from '@/modules/auth/utils/sessionQueries';
import { personalizedViews } from '@/modules/courses/utils/personalization';
import { groupKeys } from '@/modules/groups/utils/groupQueries';
import { taskKeys } from '@/modules/tasks/utils/taskQueries';
import { todoKeys } from '@/modules/todos/utils/todoQueries';

/** Other topics of the same group whose views show what the topic holds. */
const SHOWN_IN: Record<GroupTopic, readonly GroupTopic[]> = {
  tasks: [],
  announcements: [],
  schedule: [],
  subjects: ['schedule', 'tasks'],
  members: [],
  settings: [],
  taskMarks: ['tasks'],
  courses: ['schedule', 'tasks'],
};

/**
 * Topics the session's summary of each group includes: role and mute, name
 * and permissions, and whether the member still has to pick courses.
 */
const IN_SESSION: ReadonlySet<GroupTopic> = new Set([
  'members',
  'settings',
  'subjects',
  'courses',
]);

function groupInvalidations(
  groupId: string,
  topic: GroupTopic,
): InvalidateQueryFilters[] {
  const filters: InvalidateQueryFilters[] = [topic, ...SHOWN_IN[topic]].map(
    (shown) => ({ queryKey: groupKeys.topic(groupId, shown) }),
  );
  if (IN_SESSION.has(topic)) filters.push({ queryKey: sessionKey });
  if (topic === 'taskMarks') filters.push({ queryKey: taskKeys.marks() });
  if (topic === 'courses') filters.push({ queryKey: accountKeys.me() });
  return filters;
}

const ACCOUNT_INVALIDATIONS: Record<AccountTopic, InvalidateQueryFilters[]> = {
  groups: [{ queryKey: sessionKey }],
  todos: [{ queryKey: todoKeys.all }],
  profile: [{ queryKey: accountKeys.me() }, personalizedViews],
  security: [{ queryKey: accountKeys.all }],
};

const PLATFORM_INVALIDATIONS: Record<PlatformTopic, InvalidateQueryFilters[]> =
  {
    systemAnnouncements: [{ queryKey: announcementKeys.system() }],
    // Only superadmins stay signed in during a shutdown, on its controls.
    access: [{ queryKey: adminKeys.accessControls() }],
  };

/** The queries that may show what an event says changed. */
export function invalidationsFor(event: LiveEvent): InvalidateQueryFilters[] {
  switch (event.scope) {
    case 'group':
      return groupInvalidations(event.groupId, event.topic);
    case 'account':
      return ACCOUNT_INVALIDATIONS[event.topic];
    case 'platform':
      return PLATFORM_INVALIDATIONS[event.topic];
    case 'resync':
      return [{}];
  }
}
