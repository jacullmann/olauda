import { useRouter, type RouteRecordName } from 'vue-router';

/**
 * Switching groups is plain navigation: the group lives in the URL. On a
 * group page the same page of the other group opens, elsewhere `fallback`.
 */
export function useOpenGroup() {
  const router = useRouter();

  function openGroup(
    groupId: string,
    fallback: RouteRecordName = 'group-dashboard',
  ) {
    const current = router.currentRoute.value;
    const onGroupPage =
      typeof current.params.groupId === 'string' && current.name;

    return router.push(
      onGroupPage
        ? { name: current.name, params: { ...current.params, groupId } }
        : { name: fallback, params: { groupId } },
    );
  }

  return { openGroup };
}
