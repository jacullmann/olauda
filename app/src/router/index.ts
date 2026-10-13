import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useSession } from '@/modules/auth/composables/useSession';
import { useGroups } from '@/modules/groups/composables/useGroups';
import { useLoadingBar } from '@/shell/composables/useLoadingBar';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import i18n from '@/i18n';
import { consumePendingInviteRoute } from '@/modules/groups/utils/invites';
import {
  consumeLoginReturn,
  saveLoginReturn,
} from '@/modules/auth/utils/loginReturn';
import { useAccessStatusStore } from '@/modules/auth/stores/useAccessStatusStore';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: { name: 'groups' },
  },
  {
    path: '/login',
    component: () => import('@/modules/auth/pages/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'login',
        component: () => import('@/modules/auth/pages/AuthLoginPage.vue'),
        meta: { title: 'auth.login.login', access: 'guest' },
      },
    ],
  },
  {
    path: '/register',
    component: () => import('@/modules/auth/pages/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'register',
        component: () => import('@/modules/auth/pages/AuthRegisterPage.vue'),
        meta: { title: 'auth.login.register', access: 'guest' },
      },
    ],
  },
  {
    path: '/verify-mfa',
    component: () => import('@/modules/auth/pages/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'verify-mfa',
        component: () => import('@/modules/auth/pages/AuthMfaPage.vue'),
        meta: { title: 'auth.mfa.verify.title', access: 'guest' },
      },
    ],
  },
  {
    path: '/forgot-password',
    component: () => import('@/modules/auth/pages/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'forgot-password',
        component: () =>
          import('@/modules/auth/pages/AuthForgotPasswordPage.vue'),
        meta: { title: 'auth.login.reset.title', access: 'public' },
      },
    ],
  },
  {
    path: '/maintenance',
    component: () => import('@/modules/auth/pages/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'maintenance',
        component: () => import('@/modules/auth/pages/AuthMaintenancePage.vue'),
        meta: { title: 'auth.access.shutdown.title', access: 'public' },
        // Only reachable while the platform is shut down.
        beforeEnter: async () => {
          const accessStatus = useAccessStatusStore();
          await accessStatus.load();
          return accessStatus.shutdown || { name: 'login', replace: true };
        },
      },
    ],
  },

  {
    path: '/',
    component: () => import('@/shell/pages/AppLayout.vue'),
    children: [
      {
        path: 'groups',
        name: 'groups',
        component: () => import('@/modules/groups/pages/GroupListPage.vue'),
        meta: {
          title: 'navigation.home',
          headerTitle: 'groups.list.title',
        },
      },

      {
        path: 'groups/:groupId',
        component: () => import('@/modules/groups/pages/GroupLayout.vue'),
        children: [
          {
            path: '',
            redirect: { name: 'group-dashboard' },
          },
          {
            path: 'dashboard',
            name: 'group-dashboard',
            component: () =>
              import('@/modules/dashboard/pages/DashboardPage.vue'),
            props: true,
            meta: { title: 'tasks.list.title' },
          },
          {
            path: 'tasks',
            component: () => import('@/modules/tasks/pages/TaskLayout.vue'),
            meta: {
              title: 'tasks.list.title',
              // An opened task keeps the tasks entry of the navigation active.
              navItem: 'group-tasks',
            },
            children: [
              {
                path: '',
                name: 'group-tasks',
                component: () =>
                  import('@/modules/tasks/pages/TaskListPage.vue'),
                // Kept alive behind an opened task, it returns to where it was.
                meta: { headerTitle: 'tasks.list.title', restoresScroll: true },
                // Links shared before tasks had a page of their own pointed
                // into the list.
                beforeEnter: (to) =>
                  typeof to.query.highlightedTask === 'string'
                    ? {
                        name: 'group-task',
                        params: {
                          groupId: to.params.groupId,
                          taskId: to.query.highlightedTask,
                        },
                        replace: true,
                      }
                    : true,
              },
              {
                path: ':taskId',
                name: 'group-task',
                component: () =>
                  import('@/modules/tasks/pages/TaskDetailPage.vue'),
                // The page caps its own content, so files can be dropped
                // across the whole view beside it.
                meta: { fullWidth: true },
              },
            ],
          },
          {
            path: 'schedule',
            component: () =>
              import('@/modules/schedule/pages/ScheduleLayout.vue'),
            meta: {
              title: 'schedule.title',
              // An opened lesson keeps the schedule entry of the navigation active.
              navItem: 'group-schedule',
            },
            children: [
              {
                path: '',
                name: 'group-schedule',
                component: () =>
                  import('@/modules/schedule/pages/SchedulePage.vue'),
                // Kept alive behind an opened lesson, it returns to where it was.
                meta: { headerTitle: 'schedule.title', restoresScroll: true },
              },
              {
                path: ':date/:lessonId',
                name: 'group-schedule-lesson',
                component: () =>
                  import('@/modules/schedule/pages/ScheduleLessonPage.vue'),
              },
            ],
          },
          {
            path: 'settings/:tab?/:subTab?',
            name: 'group-admin',
            component: () =>
              import('@/modules/groups/pages/GroupSettingsPage.vue'),
            meta: {
              title: 'navigation.group_admin',
              fullWidth: true,
            },
          },
        ],
      },

      {
        path: 'account/:tab?/:subTab?',
        name: 'account-settings',
        component: () =>
          import('@/modules/account/pages/AccountSettingsPage.vue'),
        meta: { title: 'navigation.account_settings', fullWidth: true },
      },

      {
        path: 'private',
        name: 'private-todos',
        component: () => import('@/modules/todos/pages/TodoListPage.vue'),
        meta: {
          title: 'navigation.private_todos',
          headerTitle: 'tasks.private_tasks.title',
        },
      },
      {
        path: 'todos',
        redirect: { name: 'private-todos' },
      },
    ],
  },

  {
    path: '/admin',
    component: () => import('@/shell/pages/AppLayout.vue'),
    meta: {
      title: 'navigation.super_admin',
      headerTitle: 'navigation.super_admin',
      requiresSuperAdmin: true,
      navItem: 'super-admin',
      fullWidth: true,
    },
    children: [
      {
        path: '',
        component: () => import('@/modules/admin/pages/AdminLayout.vue'),
        children: [
          { path: '', redirect: { name: 'super-admin' } },
          {
            path: 'overview',
            name: 'super-admin',
            component: () =>
              import('@/modules/admin/pages/AdminOverviewPage.vue'),
            meta: { adminTab: 'overview' },
          },
          {
            path: 'directory',
            meta: { adminTab: 'directory' },
            children: [
              {
                path: '',
                component: () =>
                  import('@/modules/admin/pages/AdminDirectoryLayout.vue'),
                children: [
                  { path: '', redirect: { name: 'admin-users' } },
                  {
                    path: 'users',
                    name: 'admin-users',
                    component: () =>
                      import('@/modules/admin/pages/AdminUsersPage.vue'),
                  },
                  {
                    path: 'groups',
                    name: 'admin-groups',
                    component: () =>
                      import('@/modules/admin/pages/AdminGroupsPage.vue'),
                  },
                ],
              },
              {
                path: 'users/:userId',
                name: 'admin-user',
                component: () =>
                  import('@/modules/admin/pages/AdminUserPage.vue'),
                props: true,
              },
              {
                // Not `:groupId`, which the router treats as opening the group itself.
                path: 'groups/:adminGroupId',
                name: 'admin-group',
                component: () =>
                  import('@/modules/admin/pages/AdminGroupPage.vue'),
                props: (route) => ({ groupId: route.params.adminGroupId }),
              },
            ],
          },
          {
            path: 'log',
            name: 'admin-log',
            component: () => import('@/modules/admin/pages/AdminLogPage.vue'),
            meta: { adminTab: 'log' },
          },
          {
            path: 'reports',
            name: 'admin-reports',
            component: () =>
              import('@/modules/admin/pages/AdminReportsPage.vue'),
            meta: { adminTab: 'reports' },
          },
          {
            path: 'announcements',
            name: 'admin-announcements',
            component: () =>
              import('@/modules/admin/pages/AdminAnnouncementsPage.vue'),
            meta: { adminTab: 'announcements' },
          },
        ],
      },
    ],
  },

  {
    path: '/invite/:token',
    component: () => import('@/shell/pages/AppSimpleLayout.vue'),
    children: [
      {
        path: '',
        name: 'group-invite',
        component: () => import('@/modules/groups/pages/GroupInvitePage.vue'),
        props: true,
        meta: { title: 'navigation.group_invite', access: 'public' },
      },
    ],
  },

  {
    path: '/account/security/password/edit',
    component: () => import('@/shell/pages/AppSimpleLayout.vue'),
    children: [
      {
        path: '',
        name: 'account-password-edit',
        component: () =>
          import('@/modules/account/pages/AccountPasswordPage.vue'),
        meta: {
          title: () =>
            useUserStore().hasPassword
              ? 'auth.change_password.title'
              : 'auth.set_password.title',
        },
      },
    ],
  },

  {
    // Kept out of the group's own layout until the member is done with it.
    path: '/groups/:groupId/setup',
    component: () => import('@/shell/pages/AppSimpleLayout.vue'),
    children: [
      {
        path: '',
        name: 'group-course-setup',
        component: () => import('@/modules/courses/pages/CourseSetupPage.vue'),
        meta: { title: 'navigation.course_setup' },
      },
    ],
  },

  {
    path: '/:pathMatch(.*)*',
    component: () => import('@/shell/pages/AppLayout.vue'),
    children: [
      {
        path: '',
        name: 'not-found',
        component: () => import('@/shell/pages/AppNotFoundPage.vue'),
        meta: { title: 'navigation.not_found', fullWidth: true },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (to.meta.restoresScroll) return false;
    if (savedPosition) return savedPosition;
    // Switching tabs within a page keeps the tabs where they are on screen.
    const samePage =
      to.name === from.name && to.params.groupId === from.params.groupId;
    return samePage ? false : { top: 0 };
  },
});

const { start, finish } = useLoadingBar();
const { isLoggedIn, isAuthReady, isApiUnreachable, initAuth } = useSession();
const { homeRoute, canShowGroup, showGroup, findGroup } = useGroups();

/**
 * Group pages a member with a pending course setup may still open: the setup
 * itself, and the settings, where an admin adding the group's first courses
 * must not be sent away from the subjects they are still editing.
 */
const OPEN_DURING_COURSE_SETUP = new Set(['group-course-setup', 'group-admin']);

const CHUNK_RELOAD_KEY = 'olauda:chunk-reload';
const CHUNK_RELOAD_COOLDOWN_MS = 10_000;

function isChunkLoadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(
      error.message,
    )
  );
}

/**
 * A deploy replaced the chunks this tab still references, so the page is
 * reloaded on the new build. Only once within the cooldown: a deploy that is
 * itself broken must not reload the tab forever.
 */
function reloadOnNewBuild(path: string): void {
  try {
    const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY));
    if (Date.now() - lastReload < CHUNK_RELOAD_COOLDOWN_MS) return;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    return;
  }
  window.location.assign(path);
}

router.beforeEach(async (to, from) => {
  if (to.path !== from.path) start();

  if (!isAuthReady.value) await initAuth();

  // The app shows the unreachable notice instead of any page; redirecting to
  // the login page would tell a signed-in user they had been signed out.
  if (isApiUnreachable.value) {
    finish();
    return true;
  }

  if (!to.meta.access && !isLoggedIn.value) {
    finish();
    // The start page is home, which after sign-in is the user's own group.
    if (to.name !== 'groups') saveLoginReturn(to.fullPath);
    return { name: 'login', replace: true };
  }

  // Resume an invite that was opened before signing in, regardless of which
  // auth flow (password, MFA, OAuth, registration) brought the user back.
  if (isLoggedIn.value && to.name !== 'group-invite') {
    const inviteRoute = consumePendingInviteRoute();
    if (inviteRoute) {
      finish();
      return { ...inviteRoute, replace: true };
    }
  }

  if (to.meta.access === 'guest' && isLoggedIn.value) {
    finish();
    const returnPath = consumeLoginReturn();
    const target = returnPath ? router.resolve(returnPath) : homeRoute.value;
    return { ...target, replace: true };
  }

  const userStore = useUserStore();
  if (isLoggedIn.value && !to.meta.access && !userStore.initialized) {
    try {
      await userStore.fetchUser();
    } catch {
      // Navigation must not be blocked by a failed profile fetch.
    }
  }

  // After the profile fetch, so a title that depends on the user sees it.
  const titleKey =
    typeof to.meta.title === 'function' ? to.meta.title() : to.meta.title;
  document.title = titleKey ? `${i18n.global.t(titleKey)} | Olauda` : 'Olauda';

  if (to.meta.requiresSuperAdmin) {
    if (!userStore.initialized) await userStore.fetchUser();
    if (!userStore.isSuperadmin) {
      finish();
      return { name: 'groups', replace: true };
    }
  }

  const routeGroupId = to.params.groupId;
  if (typeof routeGroupId === 'string') {
    if (!(await canShowGroup(routeGroupId))) {
      finish();
      return { name: 'groups', replace: true };
    }

    const group = findGroup(routeGroupId);
    // A banned group's layout tells its members so. The course setup lies
    // outside that layout, so it leads to the group instead.
    if (group?.banned && !userStore.isSuperadmin) {
      if (to.name !== 'group-course-setup') return;
      finish();
      return {
        name: 'group-dashboard',
        params: { groupId: routeGroupId },
        replace: true,
      };
    }

    if (
      group?.courseSetup === 'pending' &&
      !OPEN_DURING_COURSE_SETUP.has(to.name as string)
    ) {
      finish();
      return {
        name: 'group-course-setup',
        params: { groupId: routeGroupId },
        replace: true,
      };
    }
  }
});

// A navigation that throws never reaches afterEach.
router.onError((error, to) => {
  finish();
  if (isChunkLoadError(error)) reloadOnNewBuild(to.fullPath);
});

router.afterEach((to, _from, failure) => {
  if (!failure) {
    const groupId = to.params.groupId;
    showGroup(typeof groupId === 'string' ? groupId : null);
  }
  finish();
});

export default router;
