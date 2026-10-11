import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useAppAuth } from '@/modules/auth/composables/useAppAuth';
import { useLoadingBar } from '@/common/composables/loadingState';
import { useUserStore } from '@/stores/userStore';
import i18n from '@/i18n';
import { consumePendingInviteRoute } from '@/modules/auth/utils/pendingInvite';
import {
  consumeLoginReturn,
  saveLoginReturn,
} from '@/modules/auth/utils/loginReturn';
import { useAccessStatusStore } from '@/stores/accessStatusStore';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: { name: 'groups' },
  },
  {
    path: '/login',
    component: () => import('@/layouts/LoginLayout.vue'),
    children: [
      {
        path: '',
        name: 'login',
        component: () => import('@/modules/auth/pages/LoginPage.vue'),
        meta: { title: 'auth.login.login', access: 'guest' },
      },
    ],
  },
  {
    path: '/register',
    component: () => import('@/layouts/LoginLayout.vue'),
    children: [
      {
        path: '',
        name: 'register',
        component: () => import('@/modules/auth/pages/RegisterPage.vue'),
        meta: { title: 'auth.login.register', access: 'guest' },
      },
    ],
  },
  {
    path: '/verify-mfa',
    component: () => import('@/layouts/LoginLayout.vue'),
    children: [
      {
        path: '',
        name: 'verify-mfa',
        component: () => import('@/modules/auth/pages/MfaPage.vue'),
        meta: { title: 'auth.mfa.verify.title', access: 'guest' },
      },
    ],
  },
  {
    path: '/forgot-password',
    component: () => import('@/layouts/LoginLayout.vue'),
    children: [
      {
        path: '',
        name: 'forgot-password',
        component: () => import('@/modules/auth/pages/ForgotPasswordPage.vue'),
        meta: { title: 'auth.login.reset.title', access: 'public' },
      },
    ],
  },
  {
    path: '/maintenance',
    component: () => import('@/layouts/LoginLayout.vue'),
    children: [
      {
        path: '',
        name: 'maintenance',
        component: () => import('@/modules/auth/pages/MaintenancePage.vue'),
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
    component: () => import('@/layouts/DefaultLayout.vue'),
    children: [
      {
        path: 'groups',
        name: 'groups',
        component: () => import('@/modules/groups/pages/Groups.vue'),
        meta: {
          title: 'navigation.home',
          headerTitle: 'groups.list.your_groups',
        },
      },

      {
        path: 'groups/:groupId',
        children: [
          {
            path: '',
            redirect: { name: 'group-dashboard' },
          },
          {
            path: 'dashboard',
            name: 'group-dashboard',
            component: () => import('@/modules/dashboard/pages/Dashboard.vue'),
            props: true,
            meta: { title: 'tasks.list.title' },
          },
          {
            path: 'tasks',
            component: () => import('@/modules/tasks/pages/Tasks.vue'),
            meta: {
              title: 'tasks.list.title',
              // An opened task keeps the tasks entry of the navigation active.
              navItem: 'group-tasks',
            },
            children: [
              {
                path: '',
                name: 'group-tasks',
                component: () => import('@/modules/tasks/pages/TaskList.vue'),
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
                component: () => import('@/modules/tasks/pages/TaskDetail.vue'),
                // The page caps its own content, so files can be dropped
                // across the whole view beside it.
                meta: { fullWidth: true },
              },
            ],
          },
          {
            path: 'schedule',
            name: 'group-schedule',
            component: () => import('@/modules/schedule/pages/Schedule.vue'),
            meta: { title: 'schedule.title', headerTitle: 'schedule.title' },
          },
          {
            path: 'messages',
            name: 'group-messages',
            component: () => import('@/modules/chat/pages/Messages.vue'),
            meta: {
              title: 'common.sidebar.messages',
              headerTitle: 'common.sidebar.messages',
            },
          },
          {
            path: 'settings/:tab?/:subTab?',
            name: 'group-admin',
            component: () => import('@/modules/groups/pages/GroupSettings.vue'),
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
        component: () => import('@/modules/auth/pages/AccountSettings.vue'),
        meta: { title: 'navigation.account_settings', fullWidth: true },
      },

      {
        path: 'private',
        name: 'private-todos',
        component: () => import('@/modules/tasks/pages/PrivateTasks.vue'),
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
    component: () => import('@/layouts/DefaultLayout.vue'),
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
        component: () =>
          import('@/modules/admin/pages/SuperAdminDashboard.vue'),
        children: [
          { path: '', redirect: { name: 'super-admin' } },
          {
            path: 'overview',
            name: 'super-admin',
            component: () =>
              import('@/modules/admin/pages/SuperAdminOverview.vue'),
            meta: { adminTab: 'overview' },
          },
          {
            path: 'directory',
            meta: { adminTab: 'directory' },
            children: [
              {
                path: '',
                component: () =>
                  import('@/modules/admin/pages/SuperAdminDirectory.vue'),
                children: [
                  { path: '', redirect: { name: 'admin-users' } },
                  {
                    path: 'users',
                    name: 'admin-users',
                    component: () =>
                      import('@/modules/admin/pages/SuperAdminUsers.vue'),
                  },
                  {
                    path: 'groups',
                    name: 'admin-groups',
                    component: () =>
                      import('@/modules/admin/pages/SuperAdminGroups.vue'),
                  },
                ],
              },
              {
                path: 'users/:userId',
                name: 'admin-user',
                component: () =>
                  import('@/modules/admin/pages/SuperAdminUserDetail.vue'),
                props: true,
              },
            ],
          },
          {
            path: 'log',
            name: 'admin-log',
            component: () => import('@/modules/admin/pages/SuperAdminLog.vue'),
            meta: { adminTab: 'log' },
          },
          {
            path: 'reports',
            name: 'admin-reports',
            component: () =>
              import('@/modules/admin/pages/SuperAdminReports.vue'),
            meta: { adminTab: 'reports' },
          },
          {
            path: 'announcements',
            name: 'admin-announcements',
            component: () =>
              import('@/modules/admin/pages/SuperAdminAnnouncements.vue'),
            meta: { adminTab: 'announcements' },
          },
        ],
      },
    ],
  },

  {
    path: '/invite/:token',
    component: () => import('@/layouts/SimpleLayout.vue'),
    children: [
      {
        path: '',
        name: 'group-invite',
        component: () => import('@/core/pages/GroupInvite.vue'),
        props: true,
        meta: { title: 'navigation.group_invite', access: 'public' },
      },
    ],
  },

  {
    path: '/account/security/password/edit',
    component: () => import('@/layouts/SimpleLayout.vue'),
    children: [
      {
        path: '',
        name: 'account-password-edit',
        component: () => import('@/modules/auth/pages/PasswordPage.vue'),
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
    component: () => import('@/layouts/SimpleLayout.vue'),
    children: [
      {
        path: '',
        name: 'group-course-setup',
        component: () => import('@/modules/auth/pages/CourseSetupPage.vue'),
        meta: { title: 'navigation.course_setup' },
      },
    ],
  },

  {
    path: '/:pathMatch(.*)*',
    component: () => import('@/layouts/DefaultLayout.vue'),
    children: [
      {
        path: '',
        name: 'not-found',
        component: () => import('@/core/pages/404-Page.vue'),
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
const {
  isLoggedIn,
  isAuthReady,
  isApiUnreachable,
  initAuth,
  homeRoute,
  canShowGroup,
  showGroup,
  findGroup,
} = useAppAuth();

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
  document.title = titleKey
    ? `${i18n.global.t(titleKey)} | Olauda`
    : 'Olauda';

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

    if (
      findGroup(routeGroupId)?.courseSetup === 'pending' &&
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
