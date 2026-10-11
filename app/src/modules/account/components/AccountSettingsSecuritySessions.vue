<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Laptop, Smartphone, Monitor, Trash2, LogOut } from '@lucide/vue';
import api from '@/api/client';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import { useI18n } from 'vue-i18n';
import { formatDate } from '@/common/utils/formatDate';
import { useToast } from '@/common/composables/useToast';
import { parseUserAgent as parseDeviceUserAgent } from '@/common/utils/userAgent';

interface SessionLocation {
  city: string | null;
  country: string | null;
  countryCode: string | null;
}

interface ActiveSession {
  familyId: string;
  issuedAt: string;
  lastUsedAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  location: SessionLocation | null;
}

interface SessionsResponse {
  sessions: ActiveSession[];
  currentFamilyId: string | null;
}

const sessions = ref<ActiveSession[]>([]);
const currentFamilyId = ref<string | null>(null);
const loading = ref(true);
const revokingId = ref<string | null>(null);
const revokingAll = ref(false);
const loadFailed = ref(false);

const { t } = useI18n();
const confirmModal = useConfirmModal();
const toast = useToast();

async function fetchSessions() {
  loading.value = true;
  loadFailed.value = false;
  try {
    const res = await api.get<SessionsResponse>('/auth/sessions');
    sessions.value = res.data.sessions || [];
    currentFamilyId.value = res.data.currentFamilyId ?? null;
  } catch (err) {
    console.error('Failed to fetch active sessions:', err);
    loadFailed.value = true;
    toast.error(t('auth.sessions.errors.load'));
  } finally {
    loading.value = false;
  }
}

function isCurrentSession(session: ActiveSession): boolean {
  return (
    currentFamilyId.value !== null && session.familyId === currentFamilyId.value
  );
}

async function revokeSession(session: ActiveSession) {
  const isConfirmed = await confirmModal.ask({
    title: t('auth.sessions.delete_modal.title'),
    content: t('auth.sessions.delete_modal.message', {
      browser: parseUserAgent(session.userAgent).browser,
      os: parseUserAgent(session.userAgent).os,
    }),
    submitText: t('common.buttons.logout'),
    danger: true,
  });

  if (!isConfirmed) return;

  revokingId.value = session.familyId;
  try {
    await api.delete(`/auth/sessions/${session.familyId}`);
    sessions.value = sessions.value.filter(
      (s) => s.familyId !== session.familyId,
    );
  } catch (err) {
    console.error('Failed to revoke session:', err);
    toast.error(t('auth.sessions.errors.sign_out'));
  } finally {
    revokingId.value = null;
  }
}

async function logoutAllOtherSessions() {
  const isConfirmed = await confirmModal.ask({
    title: t('auth.sessions.delete_all_modal.title'),
    content: t('auth.sessions.delete_all_modal.message'),
    submitText: t('auth.sessions.delete_all_modal.submit'),
    danger: true,
  });

  if (!isConfirmed) return;

  revokingAll.value = true;
  try {
    await api.post('/auth/logout-others');

    sessions.value = sessions.value.filter((s) => isCurrentSession(s));
  } catch (err) {
    console.error('Failed to logout other sessions:', err);
    toast.error(t('auth.sessions.errors.sign_out_others'));
    await fetchSessions();
  } finally {
    revokingAll.value = false;
  }
}

function parseUserAgent(ua: string | null): {
  browser: string;
  os: string;
  isMobile: boolean;
} {
  const parsed = parseDeviceUserAgent(ua);
  return {
    browser: parsed.browser ?? t('auth.sessions.browser.unknown'),
    os: parsed.os ?? t('auth.sessions.os.unknown'),
    isMobile: parsed.isMobile,
  };
}

onMounted(() => {
  void fetchSessions();
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-sm/relaxed text-on-ghost-muted m-0!">
      {{ t('auth.sessions.description') }}
    </p>

    <div v-if="loadFailed" class="flex justify-center">
      <BaseButton variant="ghost" @click="fetchSessions">{{
        t('auth.sessions.actions.retry')
      }}</BaseButton>
    </div>

    <div v-else-if="loading" class="flex flex-col">
      <template v-for="i in 3" :key="i">
        <div v-if="i > 1" class="separator ml-13"></div>
        <div class="flex gap-3 items-center py-3">
          <BaseSkeleton width="10" height="10" class="shrink-0" />
          <div class="flex flex-col gap-2 flex-1">
            <BaseSkeleton height="4" class="max-w-32" />
            <BaseSkeleton height="3" class="max-w-48" />
          </div>
        </div>
      </template>
    </div>

    <template v-else>
      <div v-if="sessions.length > 1" class="flex justify-end">
        <BaseButton
          :disabled="revokingAll"
          :loading="revokingAll"
          variant="ghost"
          on="ghost"
          :icon="LogOut"
          @click="logoutAllOtherSessions"
        >
          {{ t('auth.sessions.actions.delete_all') }}
        </BaseButton>
      </div>

      <div class="flex flex-col">
        <template v-for="(session, index) in sessions" :key="session.familyId">
          <div v-if="index > 0" class="separator ml-13"></div>
          <div class="flex gap-3 items-center py-3">
            <div
              class="flex items-center justify-center size-10 text-on-ghost-muted shrink-0"
              aria-hidden="true"
            >
              <component
                :is="
                  parseUserAgent(session.userAgent).isMobile
                    ? Smartphone
                    : parseUserAgent(session.userAgent).os !==
                        t('auth.sessions.os.unknown')
                      ? Laptop
                      : Monitor
                "
                :size="24"
              />
            </div>

            <div class="flex flex-col flex-1 min-w-0">
              <span class="text-base font-semibold text-on-ghost truncate">
                {{
                  t(
                    'auth.sessions.device_label',
                    parseUserAgent(session.userAgent),
                  )
                }}
              </span>
              <span class="text-sm text-on-ghost-muted">
                {{ session.location?.city ? `${session.location.city}, ` : ''
                }}{{
                  session.location?.country ||
                  t('auth.sessions.location.unknown')
                }}
                •
                {{
                  isCurrentSession(session)
                    ? t('auth.sessions.this_device')
                    : formatDate(session.issuedAt, t)
                }}
              </span>
            </div>

            <BaseTooltip
              v-if="!isCurrentSession(session)"
              :content="t('auth.sessions.actions.delete')"
              placement="bottom"
            >
              <BaseButton
                variant="ghost"
                on="ghost"
                :icon="Trash2"
                :loading="revokingId === session.familyId"
                :aria-label="t('auth.sessions.actions.delete')"
                @click="revokeSession(session)"
              />
            </BaseTooltip>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>
