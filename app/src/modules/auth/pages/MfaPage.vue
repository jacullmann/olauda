<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/userStore';
import { useToast } from '@/common/composables/useToast';
import { useAppAuth } from '@/modules/auth/composables/useAppAuth';
import { useMfaChallenge } from '@/modules/auth/composables/useMfaChallenge';
import { consumeLoginReturn } from '@/modules/auth/utils/loginReturn';
import MfaVerifyModal from '@/modules/auth/components/MfaVerifyModal.vue';

const router = useRouter();
const { t } = useI18n();
const userStore = useUserStore();
const { checkAuthStatus, homeRoute } = useAppAuth();
const { ready, passkeyAvailable, expire, settle } = useMfaChallenge(
  () => void handleMfaExpired(),
);

async function handleMfaVerified() {
  settle();

  try {
    await checkAuthStatus();

    await userStore.fetchUser();
  } catch (error) {
    console.error('Fehler beim Laden des Users nach MFA:', error);
  }

  await router.push(consumeLoginReturn() ?? homeRoute.value);
}

async function handleMfaCancelled() {
  settle();
  await router.push({ name: 'login' });
}

async function handleMfaExpired() {
  useToast().warning(t('auth.errors.session_expired'));
  await router.replace({ name: 'login' });
}
</script>

<template>
  <MfaVerifyModal
    v-if="ready"
    :passkey-available="passkeyAvailable"
    @verified="handleMfaVerified"
    @cancelled="handleMfaCancelled"
    @expired="expire"
  />
</template>
