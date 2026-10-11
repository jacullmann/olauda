<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { Construction } from '@lucide/vue';
import AuthGoogleIcon from '@/modules/auth/components/AuthGoogleIcon.vue';
import AuthConfirmSignUpForm from '@/modules/auth/components/AuthConfirmSignUpForm.vue';
import AuthTermsCheckbox from '@/modules/auth/components/AuthTermsCheckbox.vue';
import { useRegister } from '@/modules/auth/composables/useRegister';
import { useOAuth } from '@/modules/auth/composables/useOAuth';
import { useEnterApp } from '@/modules/auth/composables/useEnterApp';
import { useAccessStatusStore } from '@/modules/auth/stores/useAccessStatusStore';
import { useI18n } from 'vue-i18n';

const router = useRouter();
const { t } = useI18n();
const { initiateGoogleLogin } = useOAuth();
const enterApp = useEnterApp();
const accessStatus = useAccessStatusStore();
const { registrationOpen } = storeToRefs(accessStatus);

const {
  email,
  password,
  passwordConfirm,
  acceptedTerms,
  submitting,
  formError,
  signUp,
  emailInputRef,
  errors,
  clearFieldError,
  restartRegistration,
  submit: submitRegister,
} = useRegister();

async function handleSubmit() {
  await submitRegister();
}

function navigateToLogin() {
  void router.push({ name: 'login' });
}

onMounted(accessStatus.load);
</script>

<template>
  <div class="flex w-full items-center justify-center">
    <AuthConfirmSignUpForm
      v-if="signUp"
      :credentials="signUp"
      code-just-sent
      @confirmed="enterApp"
      @back="restartRegistration"
    />

    <div
      v-else-if="!registrationOpen"
      class="w-full max-w-105"
      role="status"
      aria-live="polite"
    >
      <BaseEmptyState
        :icon="Construction"
        full-page
        :primary-action="navigateToLogin"
      >
        {{ t('auth.access.registration_closed.title') }}
        <template #message>
          {{ t('auth.access.registration_closed.message') }}
        </template>
        <template #primary-action-label>
          {{ t('auth.access.to_login') }}
        </template>
      </BaseEmptyState>
    </div>

    <div v-else class="w-full max-w-105">
      <div class="text-center mb-8">
        <h1 class="text-center!">
          {{ t('auth.login.register') }}
        </h1>
        <p class="text-sm text-on-ghost-muted mt-1!">
          {{
            t('auth.login.register_description', {
              defaultValue: 'Create your account',
            })
          }}
        </p>
      </div>

      <BaseForm
        :submit="handleSubmit"
        :loading="submitting"
        :error="formError"
        class="mb-4"
      >
        <template #content>
          <BaseFormGroup id="register-email" :error="errors.email">
            <BaseLabel for="register-email">
              {{ t('auth.login.email') }}
            </BaseLabel>
            <BaseInput
              id="register-email"
              ref="emailInputRef"
              v-model="email"
              :placeholder="t('auth.login.email_placeholder')"
              type="email"
              autocomplete="email"
              required
              :aria-describedby="
                errors.email ? 'register-email-error' : undefined
              "
              @input="clearFieldError('email')"
            />
          </BaseFormGroup>

          <BaseFormGroup id="register-password" :error="errors.password">
            <BaseLabel for="register-password">
              {{ t('auth.login.password') }}
            </BaseLabel>
            <BaseInput
              id="register-password"
              v-model="password"
              :placeholder="t('auth.login.password_placeholder')"
              type="password"
              autocomplete="new-password"
              required
              :aria-describedby="
                errors.password ? 'register-password-error' : undefined
              "
              @input="clearFieldError('password')"
            />
          </BaseFormGroup>

          <BaseFormGroup id="register-confirm" :error="errors.passwordConfirm">
            <BaseLabel for="register-confirm">
              {{ t('auth.login.confirm_password') }}
            </BaseLabel>
            <BaseInput
              id="register-confirm"
              v-model="passwordConfirm"
              :placeholder="t('auth.login.confirm_placeholder')"
              type="password"
              autocomplete="new-password"
              required
              :aria-describedby="
                errors.passwordConfirm ? 'register-confirm-error' : undefined
              "
              @input="clearFieldError('passwordConfirm')"
            />
          </BaseFormGroup>

          <BaseFormGroup id="register-terms" :error="errors.terms">
            <AuthTermsCheckbox
              v-model="acceptedTerms"
              class="mt-1"
              :described-by="errors.terms ? 'register-terms-error' : undefined"
              @update:model-value="clearFieldError('terms')"
            />
          </BaseFormGroup>
        </template>

        <template #action-text>
          {{ t('auth.login.register') }}
        </template>
      </BaseForm>

      <div class="flex items-center gap-2 mb-4">
        <div class="flex-1 h-px bg-ghost-border" />
        <span class="text-xs text-on-ghost-muted">
          {{ t('auth.login.or_continue_with') }}
        </span>
        <div class="flex-1 h-px bg-ghost-border" />
      </div>

      <BaseButton
        type="button"
        surface
        variant="ghost"
        class="w-full justify-center pl-5"
        :icon="AuthGoogleIcon"
        @click="initiateGoogleLogin"
      >
        {{ t('auth.login.register_google') }}
      </BaseButton>

      <!-- Switch to Login -->
      <div class="text-center mt-8">
        <p class="text-sm text-on-ghost-muted">
          {{
            t('auth.login.have_account', {
              defaultValue: 'Already have an account?',
            })
          }}
          <button
            type="button"
            class="text-on-ghost font-medium hover:opacity-75 transition-opacity cursor-pointer"
            @click="navigateToLogin"
          >
            {{ t('auth.login.login') }}
          </button>
        </p>
      </div>
    </div>
  </div>
</template>
