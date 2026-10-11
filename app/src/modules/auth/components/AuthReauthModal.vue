<script setup lang="ts">
import { computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import AuthGoogleIcon from './AuthGoogleIcon.vue';
import AuthSecondFactorInput from './AuthSecondFactorInput.vue';
import { useReauth } from '@/modules/auth/composables/useReauth';
import { passkeyIcon } from '@/modules/auth/utils/passkeyIcon';
import { useReauthModal } from '@/modules/auth/stores/useReauthModal';

const { t } = useI18n();
const modal = useReauthModal();
const { isOpen, step } = storeToRefs(modal);

const {
  methods,
  loading,
  submitting,
  error,
  password,
  secondFactor,
  proof,
  needsSecondFactor,
  passkeysUsable,
  passwordReady,
  load,
  confirmWithPassword,
  confirmWithPasskey,
  confirmWithGoogle,
  confirmGoogleSecondFactor,
} = useReauth(step, () => modal.settle(true));

const askingSecondFactorOnly = computed(
  () => step.value === 'google-second-factor',
);
const offersPassword = computed(
  () => !askingSecondFactorOnly.value && !!methods.value?.password,
);

const submit = computed(() => {
  if (askingSecondFactorOnly.value) return confirmGoogleSecondFactor;
  return offersPassword.value ? confirmWithPassword : undefined;
});
const requirement = computed(() =>
  askingSecondFactorOnly.value ? !!proof.value : passwordReady.value,
);

// Each opening starts from a clean form and current sign-in methods. The
// dialog loads lazily, possibly only once it is first asked for.
watch(
  isOpen,
  (open) => {
    if (open) void load();
  },
  { immediate: true },
);
</script>

<template>
  <BaseModal
    :open="isOpen"
    :submit="submit"
    :loading="submitting"
    :requirement="requirement"
    :error="error"
    @cancel="modal.settle(false)"
  >
    <template #title>{{ t('auth.reauth.title') }}</template>

    <template #content>
      <!-- Without a password field the dialog has no form of its own to
           show errors in, e.g. for passkey or Google-only accounts. -->
      <BaseFormContent :error="submit ? '' : error">
        <div v-if="loading" class="flex justify-center py-6">
          <BaseSpinner />
        </div>

        <div v-else-if="askingSecondFactorOnly" class="flex flex-col gap-4">
          <p class="m-0! text-sm/relaxed text-on-ghost-muted">
            {{ t('auth.reauth.google_second_factor') }}
          </p>
          <AuthSecondFactorInput
            id="reauth-second-factor"
            v-model="secondFactor"
            :invalid="!!error"
            @input="error = ''"
            @complete="confirmGoogleSecondFactor"
          />
        </div>

        <div v-else-if="methods" class="flex flex-col gap-4">
          <p class="m-0! text-sm/relaxed text-on-ghost-muted">
            {{ t('auth.reauth.description') }}
          </p>

          <div
            v-if="passkeysUsable || methods.google"
            class="flex flex-col gap-2"
          >
            <BaseButton
              v-if="passkeysUsable"
              variant="action"
              full
              :disabled="submitting"
              @click="confirmWithPasskey"
            >
              <component :is="passkeyIcon" :size="18" />
              {{ t('auth.reauth.with_passkey') }}
            </BaseButton>
            <BaseButton
              v-if="methods.google"
              full
              :disabled="submitting"
              @click="confirmWithGoogle"
            >
              <AuthGoogleIcon :size="18" />
              {{ t('auth.reauth.with_google') }}
            </BaseButton>
          </div>

          <template v-if="offersPassword">
            <p
              v-if="passkeysUsable || methods.google"
              class="m-0! text-center text-sm text-on-ghost-muted"
            >
              {{ t('auth.login.or_continue_with') }}
            </p>

            <BaseFormGroup id="reauth-password">
              <BaseLabel for="reauth-password">
                {{ t('auth.login.password') }}
              </BaseLabel>
              <BaseInput
                id="reauth-password"
                v-model="password"
                type="password"
                autocomplete="current-password"
                :placeholder="t('auth.login.password')"
                @input="error = ''"
              />
            </BaseFormGroup>

            <div v-if="needsSecondFactor" class="flex flex-col gap-2">
              <p class="m-0! text-sm/relaxed text-on-ghost-muted">
                {{ t('auth.reauth.second_factor') }}
              </p>
              <AuthSecondFactorInput
                id="reauth-password-second-factor"
                v-model="secondFactor"
                :invalid="!!error"
                @input="error = ''"
              />
            </div>
          </template>
        </div>

        <div v-else class="flex justify-center">
          <BaseButton @click="load">{{ t('common.buttons.retry') }}</BaseButton>
        </div>
      </BaseFormContent>
    </template>

    <template #action-text>{{ t('auth.reauth.confirm') }}</template>
  </BaseModal>
</template>
