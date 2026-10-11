import { useRoute } from 'vue-router';

/**
 * The group a group page belongs to. AppLayout remounts pages per group,
 * so a page instance serves exactly one group and its id never changes.
 * Only valid below a `/groups/:groupId` route.
 */
export function useGroupPageId(): string {
  const groupId = useRoute().params.groupId;
  if (typeof groupId !== 'string') {
    throw new Error('useGroupPageId() used outside a /groups/:groupId route');
  }
  return groupId;
}
