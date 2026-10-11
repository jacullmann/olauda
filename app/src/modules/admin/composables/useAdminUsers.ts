import { useI18n } from 'vue-i18n';
import { useToast } from '@/common/composables/useToast';
import type {
  SortOrder,
  AdminUser,
  UserSort,
  UserStatusFilter,
} from '@/modules/admin/types';
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
  const toast = useToast();
  const { t } = useI18n();

  return useServerPagedList<
    AdminUser,
    {
      search: string;
      status: UserStatusFilter;
      sort: UserSort;
      order: SortOrder;
    }
  >({
    endpoint: '/admin/users',
    defaults: { search: '', status: 'all', sort: 'createdAt', order: 'desc' },
    rules: {
      status: USER_STATUS_FILTERS,
      sort: USER_SORTS,
      order: SORT_ORDERS,
    },
    ascendingSorts: ['email'],
    onError: () => toast.error(t('admin.users.errors.load')),
  });
}
