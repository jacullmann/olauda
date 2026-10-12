<script setup lang="ts">
import { watch, onMounted } from 'vue';
import { useEventListener } from '@vueuse/core';
import { CloudOff } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { START_LOCATION, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { useAccessStatusStore } from '@/modules/auth/stores/useAccessStatusStore';
import { useSession } from '@/modules/auth/composables/useSession';
import { useOAuth } from '@/modules/auth/composables/useOAuth';
import { markGroupBanned } from '@/modules/groups/composables/useGroups';
import { useLoadingBar } from '@/shell/composables/useLoadingBar';
import {
  consumeLoginReturn,
  saveLoginReturn,
} from '@/modules/auth/utils/loginReturn';
import AppModalHost from '@/shell/components/AppModalHost.vue';
import AppConnectionStatus from '@/shell/components/AppConnectionStatus.vue';
import api from '@/api/client';

const router = useRouter();
const { t } = useI18n();
const userStore = useUserStore();
const accessStatus = useAccessStatusStore();
const { user } = storeToRefs(userStore);
const { isAuthReady, isApiUnreachable, checkAuthStatus } = useSession();
const { handleOAuthReturn } = useOAuth();
const { loading, progress, opacity } = useLoadingBar();

let pageloadLogged = false;

function reloadApp() {
  window.location.reload();
}

function logPageload() {
  if (pageloadLogged || !user.value) return;
  pageloadLogged = true;
  api.post('/user/activity/pageload').catch(() => {
    pageloadLogged = false;
  });
}

async function returnToLogin() {
  userStore.clearUser();
  const route = router.currentRoute.value;
  if (!route.meta.access) {
    saveLoginReturn(route.fullPath);
    await router.push({ name: 'login' });
  }
}

function handleShutdown() {
  accessStatus.enterShutdown();
  const route = router.currentRoute.value;
  // On startup the route guard sends private pages to the login already, and
  // public ones, such as sign-up, must stay reachable.
  if (route === START_LOCATION) {
    userStore.clearUser();
    return;
  }
  // Only signed-out visitors are on guest pages, so this was a sign-in that
  // shutdown turned away. Signed-in users go back to the login instead, where
  // superadmins can still sign in.
  if (route.meta.access === 'guest') {
    void router.replace({ name: 'maintenance' });
    return;
  }
  void returnToLogin();
}

watch(user, (newUser, oldUser) => {
  if (newUser && !oldUser) logPageload();
});

// index.html paints this screen before the bundle loads; App shows its own
// spinner from here on.
function removeInitialLoadingScreen() {
  document.getElementById('initial-loading-screen')?.remove();
}

watch(
  isAuthReady,
  (ready) => {
    if (ready) requestAnimationFrame(removeInitialLoadingScreen);
  },
  { immediate: true },
);

onMounted(() => {
  logPageload();

  handleOAuthReturn(async () => {
    await checkAuthStatus();
    await userStore.fetchUser();
    const returnPath = consumeLoginReturn();
    if (returnPath) await router.replace(returnPath);
  });

  useEventListener(window, 'auth-expired', () => void returnToLogin());
  useEventListener(window, 'shutdown', handleShutdown);
  useEventListener(window, 'group-banned', (event) => {
    if (event instanceof CustomEvent && typeof event.detail === 'string') {
      markGroupBanned(event.detail);
    }
  });
});
</script>

<template>
  <div class="flex flex-col min-h-dvh">
    <div
      v-if="loading"
      class="fixed top-0 left-0 right-0 h-[3px] w-full bg-transparent z-9999 pointer-events-none transition-all duration-200 ease-in-out"
      :style="{ opacity: opacity }"
    >
      <div
        class="h-full relative bg-accent transition-[width] duration-200 ease-out"
        :style="{ width: progress + '%' }"
      ></div>
    </div>

    <template v-if="!isAuthReady">
      <div
        key="loading"
        class="fixed inset-0 flex items-center justify-center bg-canvas z-[var(--z-auth-loading)]"
      >
        <BaseSpinner on="ghost" size="40px" />
      </div>
    </template>

    <main
      v-else-if="isApiUnreachable"
      class="flex flex-1 items-center justify-center px-4"
    >
      <BaseEmptyState :icon="CloudOff" full-page :primary-action="reloadApp">
        {{ t('common.connection.unreachable.title') }}
        <template #message>{{
          t('common.connection.unreachable.message')
        }}</template>
        <template #primary-action-label>{{
          t('common.connection.unreachable.retry')
        }}</template>
      </BaseEmptyState>
    </main>

    <template v-else>
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>

      <AppModalHost />
      <BaseToast />
    </template>

    <AppConnectionStatus />
  </div>
</template>
