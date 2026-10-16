<script setup lang="ts">
import { useRouter } from 'vue-router';
import AuthGoogleIcon from '@/modules/auth/components/AuthGoogleIcon.vue';
import AuthConfirmSignUpForm from '@/modules/auth/components/AuthConfirmSignUpForm.vue';
import { useLogin } from '@/modules/auth/composables/useLogin';
import { useOAuth } from '@/modules/auth/composables/useOAuth';
import { useEnterApp } from '@/modules/auth/composables/useEnterApp';
import { usePasskeySignIn } from '@/modules/auth/composables/usePasskeySignIn';
import { passkeyIcon } from '@/modules/auth/utils/passkeyIcon';
import { useI18n } from 'vue-i18n';

const router = useRouter();
const { t } = useI18n();
const { initiateGoogleLogin } = useOAuth();
const enterApp = useEnterApp();

const {
  email,
  password,
  submitting,
  formError,
  emailInputRef,
  errors,
  unconfirmedSignUp,
  clearFieldError,
  submit: submitLogin,
} = useLogin(enterApp, async () => {
  await router.push({ name: 'verify-mfa' });
});

const {
  supported: passkeysSupported,
  signingIn: passkeySigningIn,
  signInWithPasskey,
} = usePasskeySignIn(enterApp);

async function handleSubmit() {
  await submitLogin();
}

function navigateToRegister() {
  void router.push({ name: 'register' });
}
</script>

<template>
  <div class="flex w-full items-center justify-center">
    <!-- Whoever signed up but never confirmed the address can do so here
         with the password they just entered, even when the first code
         went astray. -->
    <AuthConfirmSignUpForm
      v-if="unconfirmedSignUp"
      :credentials="unconfirmedSignUp"
      @confirmed="enterApp"
      @back="unconfirmedSignUp = null"
    />

    <div v-else class="w-full max-w-105">
      <div class="text-center mb-8">
        <h1 class="text-center!">
          {{ t('auth.login.login') }}
        </h1>
        <p class="text-sm text-on-ghost-muted mt-1!">
          {{
            t('auth.login.login_description', { defaultValue: 'Welcome back' })
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
          <BaseFormGroup id="login-email" :error="errors.email">
            <BaseLabel for="login-email">
              {{ t('auth.login.email') }}
            </BaseLabel>
            <BaseInput
              id="login-email"
              ref="emailInputRef"
              v-model="email"
              :placeholder="t('auth.login.email_placeholder')"
              type="email"
              autocomplete="email webauthn"
              required
              :aria-describedby="errors.email ? 'login-email-error' : undefined"
              @input="clearFieldError('email')"
            />
          </BaseFormGroup>

          <BaseFormGroup id="login-password" :error="errors.password">
            <BaseLabel for="login-password">
              {{ t('auth.login.password') }}
            </BaseLabel>
            <BaseInput
              id="login-password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
              :aria-describedby="
                errors.password ? 'login-password-error' : undefined
              "
              @input="clearFieldError('password')"
            />
          </BaseFormGroup>

          <div class="flex justify-end">
            <BaseLink :to="{ name: 'forgot-password' }">
              {{ t('auth.login.forgot') }}
            </BaseLink>
          </div>
        </template>

        <template #action-text>
          {{ t('auth.login.login') }}
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
        {{ t('auth.login.login_google') }}
      </BaseButton>
      <template v-if="passkeysSupported">
        <BaseButton
          type="button"
          surface
          variant="ghost"
          class="w-full justify-center pl-5 mt-2"
          :icon="passkeyIcon"
          :loading="passkeySigningIn"
          :disabled="passkeySigningIn"
          @click="signInWithPasskey"
        >
          {{ t('auth.passkeys.sign_in') }}
        </BaseButton>
      </template>
      <div class="text-center mt-8">
        <p class="text-sm text-on-ghost-muted">
          {{
            t('auth.login.no_account', {
              defaultValue: "Don't have an account?",
            })
          }}
          <button
            type="button"
            class="text-on-ghost font-medium hover:opacity-75 transition-opacity cursor-pointer"
            @click="navigateToRegister"
          >
            {{ t('auth.login.register') }}
          </button>
        </p>
      </div>
    </div>
  </div>
</template>
