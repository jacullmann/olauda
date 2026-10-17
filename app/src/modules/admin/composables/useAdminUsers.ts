import { useI18n } from 'vue-i18n';
import { apiErrorMessage } from '@/api/errors';
import type {
  SortOrder,
  AdminUser,
  UserSort,
  UserStatusFilter,
} from '@/modules/admin/types';
import { adminKeys, adminUsersQuery } from '@/modules/admin/utils/adminQueries';
import { useServerPagedList } from './useServerPagedList';

export const USER_STATUS_FILTERS = [
  'all',
  'active',
  'banned',
  'superadmin',
] as const satisfies readonly UserStatusFilter[];

const USER_SORTS = [
  'createdAt',
  'lastLoginAt',
  'email',
] as const satisfies readonly UserSort[];

const SORT_ORDERS = ['asc', 'desc'] as const satisfies readonly SortOrder[];

export function useAdminUsers() {
  const { t } = useI18n();

  return useServerPagedList<
    {
      search: string;
      status: UserStatusFilter;
      sort: UserSort;
      order: SortOrder;
    },
    AdminUser,
    ReturnType<typeof adminUsersQuery>['queryKey']
  >({
    query: adminUsersQuery,
    listKey: adminKeys.userLists(),
    defaults: { search: '', status: 'all', sort: 'createdAt', order: 'desc' },
    rules: {
      status: USER_STATUS_FILTERS,
      sort: USER_SORTS,
      order: SORT_ORDERS,
    },
    ascendingSorts: ['email'],
    loadErrorMessage: (error) =>
      apiErrorMessage(error, t('admin.users.errors.load')),
  });
}
