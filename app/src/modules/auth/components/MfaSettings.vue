<script setup lang="ts">
import {
  ref,
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  useTemplateRef,
} from 'vue';
import {
  ShieldCheck,
  ShieldOff,
  Copy,
  Check,
  Clock,
  AlertCircle,
  AlertTriangle,
  LifeBuoy,
} from '@lucide/vue';
import { useMfa } from '@/modules/auth/composables/useMfa';
import { useI18n } from 'vue-i18n';
import RecoveryCodes from '@/modules/auth/components/RecoveryCodes.vue';
import { useToast } from '@/common/composables/useToast';
import { useConfirmModal } from '@/stores/modalStore';
import { useQrCode } from '@/common/composables/useQrCode';
import { useLeaveGuard } from '@/common/composables/useLeaveGuard';

/** Below this many unused codes, the user is nudged to create new ones. */
const LOW_RECOVERY_CODES = 3;

const { t } = useI18n();
const toast = useToast();
const confirmModal = useConfirmModal();

defineProps<{
  mfaEnabled: boolean;
}>();

const emit = defineEmits<{
  (e: 'mfaChanged', enabled: boolean): void;
}>();

const {
  recoveryCodesLeft,
  mfaError,
  fetchMfaStatus,
  startMfaSetup,
  activateMfa: doActivateMfa,
  deactivateMfa: doDeactivateMfa,
  regenerateRecoveryCodes: doRegenerateRecoveryCodes,
} = useMfa();

const setupMode = ref(false);
const setupStep = ref(1);
const otpauthUrl = ref<string | null>(null);
const { qrCodeUrl } = useQrCode(otpauthUrl);
const manualSecret = ref<string | null>(null);
const expiresAt = ref<Date | null>(null);
const verifyCode = ref('');
const verifyError = ref<string | null>(null);
const loading = ref(false);
const copied = ref(false);

/** Shown once after they are created; only their hashes are stored. */
const newRecoveryCodes = ref<string[] | null>(null);

useLeaveGuard(
  () => newRecoveryCodes.value !== null,
  () =>
    confirmModal.ask({
      title: t('auth.recovery_codes.leave_title'),
      content: t('auth.recovery_codes.leave_warning'),
      submitText: t('auth.recovery_codes.leave_confirm'),
      danger: true,
    }),
);

const codeInput = useTemplateRef<{ focus: () => void }>('codeInput');

const recoveryCodesLow = computed(
  () =>
    recoveryCodesLeft.value !== null &&
    recoveryCodesLeft.value <= LOW_RECOVERY_CODES,
);

onMounted(() => void fetchMfaStatus());

let timerInterval: ReturnType<typeof setInterval> | null = null;
const remainingTime = ref('');

const formattedSecret = computed(() => {
  if (!manualSecret.value) return '';
  return manualSecret.value.match(/.{1,4}/g)?.join(' ') || manualSecret.value;
});

function updateTimer() {
  if (!expiresAt.value) {
    remainingTime.value = '';
    return;
  }

  const now = new Date();
  const diff = expiresAt.value.getTime() - now.getTime();

  if (diff <= 0) {
    remainingTime.value = t('auth.mfa.setup.time_expired');
    verifyError.value = t('auth.mfa.errors.setup_expired');
    setTimeout(() => cancelSetup(), 2000);
    return;
  }

  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  remainingTime.value = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

async function startSetup() {
  loading.value = true;
  verifyError.value = null;

  const result = await startMfaSetup();

  if (!result && mfaError.value) toast.error(mfaError.value);

  if (result) {
    otpauthUrl.value = result.otpauthUrl;
    manualSecret.value = result.secret;
    expiresAt.value = new Date(result.expiresAt);
    setupMode.value = true;
    setupStep.value = 1;

    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
  }

  loading.value = false;
}

function cancelSetup() {
  setupMode.value = false;
  setupStep.value = 1;
  otpauthUrl.value = null;
  manualSecret.value = null;
  expiresAt.value = null;
  verifyCode.value = '';
  verifyError.value = null;

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

async function copySecret() {
  if (!manualSecret.value) return;

  try {
    await navigator.clipboard.writeText(manualSecret.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = manualSecret.value;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  }
}

async function goToVerifyStep() {
  setupStep.value = 2;
  await nextTick();
  codeInput.value?.focus();
}

async function activateMfa() {
  if (verifyCode.value.length !== 6 || loading.value) return;

  loading.value = true;
  verifyError.value = null;

  const result = await doActivateMfa(verifyCode.value);

  if (result.ok) {
    cancelSetup();
    newRecoveryCodes.value = result.data;
    emit('mfaChanged', true);
  } else {
    verifyError.value = result.error || t('auth.mfa.errors.activate');
    verifyCode.value = '';
    await nextTick();
    codeInput.value?.focus();
  }

  loading.value = false;
}

async function deactivate() {
  const confirmed = await confirmModal.ask({
    title: t('auth.mfa.deactivate.title'),
    content: t('auth.mfa.deactivate.warning'),
    submitText: t('auth.mfa.actions.deactivate'),
    danger: true,
  });
  if (!confirmed) return;

  loading.value = true;
  const result = await doDeactivateMfa();
  loading.value = false;

  if (result.ok) {
    emit('mfaChanged', false);
  } else if (result.error) {
    toast.error(result.error);
  }
}

async function regenerateRecoveryCodes() {
  const confirmed = await confirmModal.ask({
    title: t('auth.recovery_codes.regenerate_title'),
    content: t('auth.recovery_codes.regenerate_warning'),
    submitText: t('auth.recovery_codes.regenerate'),
  });
  if (!confirmed) return;

  loading.value = true;
  const result = await doRegenerateRecoveryCodes();
  loading.value = false;

  if (result.ok) {
    newRecoveryCodes.value = result.data;
  } else if (result.error) {
    toast.error(result.error);
  }
}

onUnmounted(() => {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
});
</script>

<template>
  <BaseFormContent>
    <RecoveryCodes
      v-if="newRecoveryCodes"
      :codes="newRecoveryCodes"
      @done="newRecoveryCodes = null"
    />

    <template v-else-if="!setupMode">
      <div class="flex items-center gap-2 p-3 mx-auto">
        <div
          class="flex items-center justify-center size-11 text-on-ghost-muted"
          :class="mfaEnabled ? 'text-success' : 'text-on-ghost-muted'"
        >
          <component :is="mfaEnabled ? ShieldCheck : ShieldOff" :size="32" />
        </div>
        <div class="flex flex-col">
          <span class="text-sm text-on-ghost-muted">{{
            t('auth.security.2fa')
          }}</span>
          <span
            class="text-base font-bold"
            :class="mfaEnabled ? 'text-on-ghost' : 'text-on-ghost-muted'"
          >
            {{
              mfaEnabled
                ? t('auth.security.activated')
                : t('auth.security.deactivated')
            }}
          </span>
        </div>
      </div>
      <p class="text-sm/relaxed text-on-ghost-muted m-0! font-sans">
        {{ t('auth.security.description') }}
      </p>
    </template>

    <BaseButton
      v-if="!mfaEnabled && !setupMode && !newRecoveryCodes"
      :disabled="loading"
      variant="action"
      full
      @click="startSetup"
    >
      {{ t('auth.mfa.actions.activate') }}
    </BaseButton>

    <div v-if="setupMode" class="flex flex-col gap-4">
      <div class="flex items-center justify-center gap-2">
        <div
          class="flex items-center gap-2 opacity-50"
          :class="{ '!opacity-100': setupStep === 1 || setupStep > 1 }"
        >
          <span
            class="flex items-center justify-center w-6 h-6 rounded-full bg-ghost-hover text-sm font-semibold text-on-ghost-muted"
            :class="{
              '!bg-action !text-on-action': setupStep === 1,
              '!bg-[var(--special--green)] !text-white': setupStep > 1,
            }"
            >1</span
          >
          <span
            class="text-sm text-on-ghost-muted"
            :class="{ '!text-on-ghost': setupStep === 1 }"
            >{{ t('auth.mfa.setup.steps.scan') }}</span
          >
        </div>
        <div class="w-10 h-0.5 bg-ghost-border"></div>
        <div
          class="flex items-center gap-2 opacity-50"
          :class="{ '!opacity-100': setupStep === 2 }"
        >
          <span
            class="flex items-center justify-center w-6 h-6 rounded-full bg-ghost-hover text-sm font-semibold text-on-ghost-muted"
            :class="{ '!bg-action !text-on-action': setupStep === 2 }"
            >2</span
          >
          <span
            class="text-sm text-on-ghost-muted"
            :class="{ '!text-on-ghost': setupStep === 2 }"
            >{{ t('auth.mfa.setup.steps.enter_code') }}</span
          >
        </div>
      </div>

      <div v-if="setupStep === 1" class="flex flex-col gap-4">
        <p
          class="text-sm/relaxed text-on-ghost-muted m-0! text-center font-sans"
        >
          {{ t('auth.mfa.setup.scan_instruction') }}
        </p>

        <div v-if="qrCodeUrl" class="flex justify-center mx-auto">
          <img
            :src="qrCodeUrl"
            :alt="t('auth.mfa.setup.qr_alt')"
            class="w-50 h-50 rounded-md"
          />
        </div>

        <div v-if="manualSecret" class="flex flex-col gap-2 items-center">
          <p class="text-sm text-on-ghost-muted m-0!">
            {{ t('auth.mfa.setup.manual_instruction') }}
          </p>
          <div
            class="flex items-center gap-2 p-1 bg-surface border border-ghost-border shadow-input rounded-lg"
          >
            <code
              class="font-mono text-sm text-on-ghost tracking-[4px] pl-2 py-1.5"
              >{{ formattedSecret }}</code
            >
            <button
              type="button"
              class="flex items-center justify-center p-2 bg-none border-none text-on-ghost-muted cursor-pointer rounded-lg transition-all hover:bg-ghost-hover hover:text-on-ghost"
              :title="
                copied ? t('common.buttons.copied') : t('common.buttons.copy')
              "
              @click="copySecret"
            >
              <component :is="copied ? Check : Copy" :size="16" />
            </button>
          </div>
        </div>

        <div
          v-if="expiresAt"
          class="flex items-center justify-center gap-1.5 text-sm text-on-ghost-muted font-sans"
        >
          <Clock :size="16" />
          <span>{{
            t('auth.mfa.setup.time_valid', { time: remainingTime })
          }}</span>
        </div>

        <BaseRow justify="end">
          <BaseButton variant="ghost" @click="cancelSetup">{{
            t('common.buttons.cancel')
          }}</BaseButton>
          <BaseButton variant="action" @click="goToVerifyStep">{{
            t('auth.mfa.actions.next')
          }}</BaseButton>
        </BaseRow>
      </div>

      <div v-if="setupStep === 2" class="flex flex-col gap-4">
        <p
          class="text-sm/relaxed text-on-ghost-muted m-0! text-center font-sans"
        >
          {{ t('auth.mfa.setup.complete_instruction') }}
        </p>

        <BaseCodeInput
          id="mfa-setup-code"
          ref="codeInput"
          v-model="verifyCode"
          :aria-label="t('auth.mfa.verify.code')"
          :invalid="!!verifyError"
          @input="verifyError = null"
          @keyup.enter="activateMfa"
          @complete="activateMfa"
        />

        <div
          v-if="verifyError"
          class="flex items-center justify-center gap-1.5 text-sm text-danger"
        >
          <AlertCircle :size="20" />
          {{ verifyError }}
        </div>

        <BaseRow justify="end">
          <BaseButton variant="ghost" @click="setupStep = 1">{{
            t('common.buttons.back')
          }}</BaseButton>
          <BaseButton
            :disabled="verifyCode.length !== 6 || loading"
            variant="action"
            :loading="loading"
            @click="activateMfa"
          >
            {{ t('auth.mfa.actions.activate') }}
          </BaseButton>
        </BaseRow>
      </div>
    </div>

    <template v-if="mfaEnabled && !setupMode && !newRecoveryCodes">
      <div
        class="flex gap-3 p-3 px-4 rounded-lg border"
        :class="
          recoveryCodesLow
            ? 'bg-danger-hover border-danger text-danger'
            : 'bg-surface border-ghost-border text-on-ghost-muted'
        "
      >
        <component
          :is="recoveryCodesLow ? AlertTriangle : LifeBuoy"
          :size="20"
          class="flex-shrink-0 my-auto"
        />
        <p class="m-0! text-sm/[1.4] text-on-ghost">
          {{
            t(
              'auth.recovery_codes.remaining',
              { count: recoveryCodesLeft ?? 0 },
              recoveryCodesLeft ?? 0,
            )
          }}
        </p>
      </div>

      <BaseButton :disabled="loading" full @click="regenerateRecoveryCodes">
        {{ t('auth.recovery_codes.regenerate') }}
      </BaseButton>

      <BaseButton :disabled="loading" variant="danger" full @click="deactivate">
        {{ t('auth.mfa.actions.deactivate') }}
      </BaseButton>
    </template>
  </BaseFormContent>
</template>
