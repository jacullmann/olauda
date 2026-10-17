import { useI18n } from 'vue-i18n';
import { apiErrorMessage } from '@/api/errors';
import type {
  GroupSort,
  GroupTypeFilter,
  SortOrder,
  AdminGroup,
} from '@/modules/admin/types';
import {
  adminKeys,
  fetchAdminGroups,
} from '@/modules/admin/utils/adminQueries';
import { useServerPagedList } from './useServerPagedList';

export const GROUP_TYPE_FILTERS = [
  'all',
  'regular',
  'abitur',
] as const satisfies readonly GroupTypeFilter[];

const GROUP_SORTS = [
  'createdAt',
  'name',
  'memberCount',
  'itemCount',
] as const satisfies readonly GroupSort[];

const SORT_ORDERS = ['asc', 'desc'] as const satisfies readonly SortOrder[];

export function useAdminGroups() {
  const { t } = useI18n();

  return useServerPagedList<
    {
      search: string;
      type: GroupTypeFilter;
      sort: GroupSort;
      order: SortOrder;
    },
    AdminGroup
  >({
    keyOf: adminKeys.groupList,
    fetchBlock: fetchAdminGroups,
    listKey: adminKeys.groupLists(),
    defaults: { search: '', type: 'all', sort: 'createdAt', order: 'desc' },
    rules: {
      type: GROUP_TYPE_FILTERS,
      sort: GROUP_SORTS,
      order: SORT_ORDERS,
    },
    ascendingSorts: ['name'],
    loadErrorMessage: (error) =>
      apiErrorMessage(error, t('admin.groups.errors.load')),
  });
}
