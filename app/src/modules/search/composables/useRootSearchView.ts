import { computed, type ComputedRef } from 'vue';
import {
  useRouter,
  type RouteLocationRaw,
  type RouteRecordName,
} from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  House,
  ListTodo,
  CalendarDays,
  Lock,
  Megaphone,
  UsersRound,
  Settings,
  Cog,
  Key,
  Library,
  Star,
  Flag,
  Building2,
  SquarePen,
  UserRoundPlus,
  UserRoundCog,
  UserRound,
  Plus,
  LucideGraduationCap,
  Filter,
  SunMoon,
  Languages,
  LucideKeyRound,
  Shield,
  Trash2,
  LogOut,
  PanelLeft,
  ScrollText,
} from '@lucide/vue';
import { useGroups } from '@/modules/groups/composables/useGroups';
import { useGroupMenuActions } from '@/modules/groups/composables/useGroupMenuActions';
import { useLogout } from '@/modules/auth/composables/useLogout';
import { useGroupAction } from '@/modules/groups/composables/useGroupAction';
import { useIsSidebarViewport } from '@/common/composables/useViewport';
import { useAnnouncementFormModal } from '@/modules/announcements/stores/useAnnouncementFormModal';
import { useCreateGroupModal } from '@/modules/groups/stores/useCreateGroupModal';
import { useDeleteAccountModal } from '@/modules/account/stores/useDeleteAccountModal';
import { useTodoFormModal } from '@/modules/todos/stores/useTodoFormModal';
import { useTaskFormModal } from '@/modules/tasks/stores/useTaskFormModal';
import { useSidebarStore } from '@/shell/stores/useSidebarStore';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import type { SearchItem, SearchView } from '@/modules/search/types';

type Command = SearchItem & { available?: boolean };

const isAvailable = (command: Command) => command.available ?? true;

const GROUP_SETTINGS_TABS = [
  { tab: 'general', icon: Cog },
  { tab: 'members', icon: UsersRound },
  { tab: 'permissions', icon: Key },
  { tab: 'schedule', icon: CalendarDays },
  { tab: 'subjects', icon: Library },
  { tab: 'announcements', icon: Megaphone },
] as const;

/** The search's full list: every page and app-wide action the user may reach. */
export function useRootSearchView(): ComputedRef<SearchView> {
  const { t } = useI18n();
  const router = useRouter();
  const { activeGroupId, checkPermission, canInAnyGroup } = useGroups();
  const { withGroup } = useGroupAction();
  const { inviteMember } = useGroupMenuActions();
  const performLogout = useLogout();
  const hasSidebar = useIsSidebarViewport();
  const userStore = useUserStore();
  const sidebarStore = useSidebarStore();
  const taskFormModal = useTaskFormModal();
  const todoFormModal = useTodoFormModal();
  const announcementFormModal = useAnnouncementFormModal();
  const createGroupModal = useCreateGroupModal();
  const deleteAccountModal = useDeleteAccountModal();

  const navigate = (to: RouteLocationRaw) => router.push(to);

  function navigateInGroup(
    name: RouteRecordName,
    params: Record<string, string> = {},
  ) {
    withGroup(
      (groupId) => void navigate({ name, params: { groupId, ...params } }),
    );
  }

  const pages = computed<Command[]>(() => {
    const inGroup = !!activeGroupId.value;

    return [
      {
        id: 'dashboard',
        label: t('common.sidebar.dashboard'),
        description: t('search.descriptions.home'),
        kind: 'link',
        icon: House,
        run: () => navigateInGroup('group-dashboard'),
      },
      {
        id: 'tasks',
        label: t('common.sidebar.tasks'),
        description: t('search.descriptions.tasks'),
        kind: 'link',
        icon: ListTodo,
        run: () => navigateInGroup('group-tasks'),
      },
      {
        id: 'schedule',
        label: t('common.sidebar.schedule'),
        description: t('search.descriptions.schedule'),
        kind: 'link',
        icon: CalendarDays,
        run: () => navigateInGroup('group-schedule'),
      },
      {
        id: 'admin',
        label: t('common.sidebar.admin'),
        description: t('search.descriptions.admin'),
        kind: 'link',
        icon: Settings,
        run: () => navigateInGroup('group-admin'),
        available: inGroup,
      },
      ...GROUP_SETTINGS_TABS.map(({ tab, icon }): Command => ({
        id: `group-settings-${tab}`,
        label: t(`groups.settings.nav.${tab}`),
        parent: t('common.sidebar.admin'),
        kind: 'link',
        icon,
        run: () => navigateInGroup('group-admin', { tab }),
        available: inGroup,
        searchOnly: true,
      })),
      {
        id: 'superadmin',
        label: t('common.roles.superadmin'),
        description: t('search.descriptions.superadmin'),
        kind: 'link',
        icon: Star,
        run: () => navigate({ name: 'super-admin' }),
        available: userStore.isSuperadmin,
      },
      {
        id: 'superadmin-users',
        label: t('admin.nav.users'),
        description: t('search.descriptions.admin_users'),
        parent: t('common.roles.superadmin'),
        kind: 'link',
        icon: UsersRound,
        run: () => navigate({ name: 'admin-users' }),
        available: userStore.isSuperadmin,
        searchOnly: true,
      },
      {
        id: 'superadmin-log',
        label: t('admin.nav.log'),
        description: t('search.descriptions.admin_log'),
        parent: t('common.roles.superadmin'),
        kind: 'link',
        icon: ScrollText,
        run: () => navigate({ name: 'admin-log' }),
        available: userStore.isSuperadmin,
        searchOnly: true,
      },
      {
        id: 'superadmin-reports',
        label: t('admin.nav.reports'),
        description: t('search.descriptions.admin_reports'),
        parent: t('common.roles.superadmin'),
        kind: 'link',
        icon: Flag,
        run: () => navigate({ name: 'admin-reports' }),
        available: userStore.isSuperadmin,
        searchOnly: true,
      },
      {
        id: 'superadmin-groups',
        label: t('admin.nav.groups'),
        description: t('search.descriptions.admin_groups'),
        parent: t('common.roles.superadmin'),
        kind: 'link',
        icon: Building2,
        run: () => navigate({ name: 'admin-groups' }),
        available: userStore.isSuperadmin,
        searchOnly: true,
      },
      {
        id: 'groups',
        label: t('common.sidebar.groups'),
        description: t('search.descriptions.groups'),
        kind: 'link',
        icon: UsersRound,
        run: () => navigate({ name: 'groups' }),
      },
      {
        id: 'private',
        label: t('common.sidebar.private'),
        description: t('search.descriptions.private'),
        kind: 'link',
        icon: Lock,
        run: () => navigate({ name: 'private-todos' }),
      },
      {
        id: 'account-settings',
        label: t('auth.account_settings.title'),
        description: t('search.descriptions.account_settings'),
        kind: 'link',
        icon: UserRoundCog,
        run: () => navigate({ name: 'account-settings' }),
      },
      {
        id: 'security',
        label: t('auth.account_settings.security.title'),
        description: t('search.descriptions.security'),
        parent: t('auth.account_settings.title'),
        kind: 'link',
        icon: Shield,
        run: () =>
          navigate({ name: 'account-settings', params: { tab: 'security' } }),
      },
      {
        id: 'account',
        label: t('auth.account_settings.account.title'),
        description: t('search.descriptions.account'),
        parent: t('auth.account_settings.title'),
        kind: 'link',
        icon: UserRound,
        run: () =>
          navigate({ name: 'account-settings', params: { tab: 'account' } }),
        searchOnly: true,
      },
    ];
  });

  const actions = computed<Command[]>(() => {
    const groupId = activeGroupId.value;

    return [
      {
        id: 'toggle-sidebar',
        label: t('common.sidebar.toggle'),
        description: t('search.descriptions.toggle_sidebar'),
        kind: 'action',
        icon: PanelLeft,
        shortcut: ['ctrl', 'shift', 'd'],
        run: sidebarStore.toggle,
        available: hasSidebar.value,
      },
      {
        id: 'create-entry',
        label: t('search.items.create_task'),
        description: t('search.descriptions.create_task'),
        kind: 'action',
        icon: SquarePen,
        shortcut: ['alt', 'n'],
        run: () => withGroup((id) => taskFormModal.openNew(id)),
      },
      {
        id: 'create-private-entry',
        label: t('search.items.create_private_task'),
        description: t('search.descriptions.create_private_task'),
        kind: 'action',
        icon: Lock,
        shortcut: ['alt', 'p'],
        run: todoFormModal.openNew,
      },
      {
        id: 'create-announcement',
        label: t('announcements.actions.create'),
        description: t('announcements.actions.create_description'),
        kind: 'action',
        icon: Megaphone,
        shortcut: ['alt', 'a'],
        run: () =>
          withGroup(
            (id) => announcementFormModal.openFor(id),
            'manage_announcements',
          ),
        available: canInAnyGroup('manage_announcements'),
      },
      {
        id: 'switch-group',
        label: t('search.items.switch_group'),
        description: t('search.descriptions.switch_group'),
        kind: 'action',
        icon: UsersRound,
        shortcut: ['ctrl', 'g'],
        opens: 'group',
      },
      {
        id: 'invite-member',
        label: t('auth.groups.invite.invite_button_header'),
        description: t('search.descriptions.invite_member'),
        kind: 'action',
        icon: UserRoundPlus,
        run: () => groupId && inviteMember(groupId),
        available: !!groupId && checkPermission('invite_members'),
      },
      {
        id: 'create-group',
        label: t('search.items.create_group'),
        description: t('search.descriptions.create_group'),
        kind: 'action',
        icon: Plus,
        run: () => createGroupModal.open(),
      },
      {
        id: 'edit-courses',
        label: t('auth.courses.title'),
        description: t('search.descriptions.edit_courses'),
        kind: 'action',
        icon: LucideGraduationCap,
        run: () => navigateInGroup('group-admin', { tab: 'courses' }),
        available: !!groupId,
      },
      {
        id: 'change-personalization',
        label: t('auth.settings.personalization'),
        description: t('search.descriptions.personalization'),
        kind: 'action',
        icon: Filter,
        opens: 'personalization',
      },
      {
        id: 'change-theme',
        label: t('auth.settings.theme.title'),
        description: t('search.descriptions.change_theme'),
        kind: 'action',
        icon: SunMoon,
        opens: 'theme',
      },
      {
        id: 'change-language',
        label: t('auth.settings.language.title'),
        description: t('search.descriptions.change_language'),
        kind: 'action',
        icon: Languages,
        opens: 'language',
      },
      {
        id: 'change-password',
        label: userStore.hasPassword
          ? t('auth.change_password.title')
          : t('auth.set_password.title'),
        description: userStore.hasPassword
          ? t('search.descriptions.change_password')
          : t('search.descriptions.set_password'),
        kind: 'action',
        icon: LucideKeyRound,
        run: () => navigate({ name: 'account-password-edit' }),
      },
      {
        id: 'delete-account',
        label: t('auth.delete_account.title'),
        description: t('search.descriptions.delete_account'),
        kind: 'action',
        icon: Trash2,
        run: () => deleteAccountModal.open(),
        searchOnly: true,
      },
      {
        id: 'logout',
        label: t('auth.actions.logout'),
        description: t('search.descriptions.logout'),
        kind: 'action',
        icon: LogOut,
        run: performLogout,
      },
    ];
  });

  return computed(() => ({
    title: t('search.modal.title'),
    placeholder: t('search.modal.placeholder'),
    resultsTitle: t('search.modal.category_results'),
    sections: [
      {
        title: t('search.modal.category_pages'),
        items: pages.value.filter(isAvailable),
      },
      {
        title: t('search.modal.category_actions'),
        items: actions.value.filter(isAvailable),
      },
    ],
  }));
}
