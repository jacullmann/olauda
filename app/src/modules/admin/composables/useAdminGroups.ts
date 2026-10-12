import { useI18n } from 'vue-i18n';
import { useToast } from '@/common/composables/useToast';
import type {
  GroupSort,
  GroupTypeFilter,
  SortOrder,
  AdminGroup,
} from '@/modules/admin/types';
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
  const toast = useToast();
  const { t } = useI18n();

  return useServerPagedList<
    AdminGroup,
    {
      search: string;
      type: GroupTypeFilter;
      sort: GroupSort;
      order: SortOrder;
    }
  >({
    endpoint: '/admin/groups',
    defaults: { search: '', type: 'all', sort: 'createdAt', order: 'desc' },
    rules: {
      type: GROUP_TYPE_FILTERS,
      sort: GROUP_SORTS,
      order: SORT_ORDERS,
    },
    ascendingSorts: ['name'],
    onError: () => toast.error(t('admin.groups.errors.load')),
  });
}
