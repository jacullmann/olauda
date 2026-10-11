<script setup lang="ts">
import { useGroups } from '@/modules/groups/composables/useGroups';
import { useInvite } from '@/modules/groups/composables/useInvite';
import { useSession } from '@/modules/auth/composables/useSession';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useToast } from '@/common/composables/useToast';
import { AlertCircle } from '@lucide/vue';
import {
  clearPendingInvite,
  savePendingInvite,
} from '@/modules/groups/utils/invites';
import { entranceDelay } from '@/common/utils/entrance';

const props = defineProps<{ token: string }>();
const { getInvite, acceptInvite } = useInvite();
const { homeRoute } = useGroups();
const { isLoggedIn } = useSession();

const ACTIVITY_INDICATOR_SPOKES = 8;
const AVATAR_SIZE = 48;

// The page chrome enters on mount; the invite details run their own wave once
// they arrive, so each order below counts from its own start.
const DESCRIPTION_ENTRANCE_ORDER = 1;
const ACTIONS_ENTRANCE_ORDER = 2;
const DETAIL_TITLE_ENTRANCE_ORDER = 1;
const DETAIL_SUBTITLE_ENTRANCE_ORDER = 2;

const { t } = useI18n();
const router = useRouter();

const toast = useToast();

const loading = ref(true);
const ok = ref(false);

const groupName = ref('');
const avatarUrl = ref<string | null>(null);
const memberCount = ref<number>(0);
const joining = ref(false);

async function loadInvite(token: string) {
  loading.value = true;
  ok.value = false;

  const res = await getInvite(token);
  if (token !== props.token) return;

  if (res.ok && res.alreadyMember && res.groupId) {
    clearPendingInvite();
    await openExistingGroup(res.groupId);
    return;
  }

  if (res.ok && res.groupName) {
    groupName.value = res.groupName;
    avatarUrl.value = res.avatarUrl || null;
    memberCount.value = res.memberCount || 0;
    ok.value = true;
  } else {
    clearPendingInvite();
  }
  loading.value = false;
}

watch(() => props.token, loadInvite, { immediate: true });

const memberCountLabel = computed(() =>
  memberCount.value === 1
    ? t('auth.groups.invite.members_count_one', { count: 1 })
    : t('auth.groups.invite.members_count_other', { count: memberCount.value }),
);

async function handleJoin() {
  if (joining.value) return;

  joining.value = true;
  try {
    const res = await acceptInvite(props.token);
    if (res.ok && res.alreadyMember && res.groupId) {
      await openExistingGroup(res.groupId);
    } else if (res.ok && res.groupId) {
      clearPendingInvite();
      // The router sends a member who still has courses to pick to the setup.
      await router.push({
        name: 'group-dashboard',
        params: { groupId: res.groupId },
      });
    } else {
      toast.error(res.error ?? t('groups.errors.join'));
    }
  } finally {
    joining.value = false;
  }
}

async function openExistingGroup(groupId: string) {
  toast.info(t('groups.notices.already_member'));
  await router.replace({ name: 'group-dashboard', params: { groupId } });
}

// The token is only persisted once the visitor chooses to sign in or sign up,
// so merely viewing a link never leaves it behind on a shared device. The
// login page links to registration, so one button covers both.
function continueWithAuth() {
  savePendingInvite(props.token);
  void router.push({ name: 'login' });
}

const isInvalid = computed(() => !loading.value && !ok.value);

function goHome() {
  void router.push(homeRoute.value);
}

const submitAction = computed(() => {
  if (isInvalid.value) return goHome;
  if (!ok.value) return undefined;
  return isLoggedIn.value ? handleJoin : continueWithAuth;
});

const submitLabel = computed(() => {
  if (isInvalid.value) return t('auth.groups.invite.btn_home');
  return t(
    isLoggedIn.value
      ? 'auth.groups.invite.btn_join'
      : 'auth.groups.invite.btn_auth',
  );
});

function handleLater() {
  if (!ok.value) return;
  clearPendingInvite();
  void router.push({ name: 'groups' });
}
</script>

<template>
  <form
    novalidate
    class="flex flex-col w-full max-w-120 max-md:self-stretch md:max-h-[min(56rem,calc(100dvh-5rem))]"
    @submit.prevent="submitAction"
  >
    <div class="flex flex-col flex-1 justify-center gap-12">
      <div>
        <h1 class="text-center! animate-enter">
          {{ t('auth.groups.invite.card_title') }}
        </h1>
        <p
          class="text-center m-0! animate-enter"
          :style="{
            '--enter-delay': entranceDelay(DESCRIPTION_ENTRANCE_ORDER),
          }"
        >
          {{ t('auth.groups.invite.card_desc') }}
        </p>
      </div>

      <div
        v-if="loading || ok"
        class="flex flex-col gap-4 justify-center items-center text-center"
      >
        <div class="grid place-items-center size-48">
          <div
            v-if="loading"
            role="status"
            class="loading-reveal flex flex-col items-center gap-3 text-sm font-medium text-on-ghost-muted"
          >
            <div
              class="activity-indicator size-8"
              :style="{ '--spoke-count': ACTIVITY_INDICATOR_SPOKES }"
              aria-hidden="true"
            >
              <span
                v-for="spoke in ACTIVITY_INDICATOR_SPOKES"
                :key="spoke"
                class="activity-indicator-spoke"
                :style="{ '--spoke-index': spoke - 1 }"
              />
            </div>
            {{ t('auth.groups.invite.loading') }}
          </div>
          <BaseAvatar
            v-else
            :name="groupName"
            :picture="avatarUrl || undefined"
            :size="AVATAR_SIZE"
            class="avatar-bloom"
          />
        </div>
        <div>
          <div class="min-h-lh font-bold text-3xl text-on-ghost">
            <span
              v-if="!loading"
              class="inline-block animate-enter"
              :style="{
                '--enter-delay': entranceDelay(DETAIL_TITLE_ENTRANCE_ORDER),
              }"
            >
              {{ groupName }}
            </span>
          </div>
          <div class="min-h-lh text-base text-on-ghost-muted">
            <span
              v-if="!loading"
              class="inline-block animate-enter"
              :style="{
                '--enter-delay': entranceDelay(DETAIL_SUBTITLE_ENTRANCE_ORDER),
              }"
            >
              {{ memberCountLabel }}
            </span>
          </div>
        </div>
      </div>

      <div v-else class="flex flex-col items-center">
        <AlertCircle class="mb-4 text-danger avatar-bloom" :size="64" />
        <h2
          class="animate-enter"
          :style="{
            '--enter-delay': entranceDelay(DETAIL_TITLE_ENTRANCE_ORDER),
          }"
        >
          {{ t('auth.groups.invite.invalid_title') }}
        </h2>
        <p
          class="mt-0! max-w-sm animate-enter"
          :style="{
            '--enter-delay': entranceDelay(DETAIL_SUBTITLE_ENTRANCE_ORDER),
          }"
        >
          {{ t('auth.groups.invite.invalid_desc') }}
        </p>
      </div>
    </div>

    <BasePageActions
      class="mt-16 animate-enter"
      :style="{ '--enter-delay': entranceDelay(ACTIONS_ENTRANCE_ORDER) }"
    >
      <BaseButton
        type="submit"
        variant="action"
        :loading="joining"
        class="w-full"
        >{{ submitLabel }}
      </BaseButton>

      <template v-if="!isInvalid" #secondary>
        <BaseButton
          type="button"
          surface
          variant="ghost"
          class="w-full"
          @click="handleLater"
          >{{ t('auth.groups.invite.btn_later') }}
        </BaseButton>
      </template>
    </BasePageActions>
  </form>
</template>

<style scoped>
/* Held back so an invite that resolves quickly never flashes a spinner. */
.loading-reveal {
  animation: fade-in 300ms var(--ease-settle) 400ms backwards;
}

/* The spokes of UIActivityIndicatorView: each fades on the same cycle,
   offset by its place in the ring, so the bright spoke sweeps clockwise. */
.activity-indicator {
  --spin-duration: 800ms;
  position: relative;
}

.activity-indicator-spoke {
  position: absolute;
  inset: 0;
  rotate: calc(var(--spoke-index) / var(--spoke-count) * 1turn);
  animation: spoke-fade var(--spin-duration) linear infinite;
  animation-delay: calc(
    var(--spoke-index) / var(--spoke-count) * var(--spin-duration) -
      var(--spin-duration)
  );
}

.activity-indicator-spoke::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  width: 10%;
  height: 30%;
  translate: -50% 0;
  border-radius: 9999px;
  background: currentColor;
}

@keyframes spoke-fade {
  from {
    opacity: 1;
  }
  to {
    opacity: 0.2;
  }
}

/* Focus and scale settle on separate curves, as in animate-enter, but the
   avatar grows in place instead of rising so it reads as the page's focal point. */
.avatar-bloom {
  animation:
    bloom-focus 700ms var(--ease-settle) backwards,
    bloom-grow 1000ms var(--ease-spring) backwards;
}

@keyframes bloom-focus {
  from {
    opacity: 0;
    filter: blur(16px);
  }
}

@keyframes bloom-grow {
  from {
    transform: scale(0.8);
  }
}
</style>
