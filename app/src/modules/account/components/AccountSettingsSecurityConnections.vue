<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useOAuth } from '@/modules/auth/composables/useOAuth';
import AuthGoogleIcon from '@/modules/auth/components/AuthGoogleIcon.vue';
import { useToast } from '@/common/composables/useToast';

const { t } = useI18n();
const toast = useToast();

const { fetchLinkedProviders, unlinkGoogleAccount, initiateGoogleLink } =
  useOAuth();

interface Provider {
  provider: string;
  email: string;
}

const providers = ref<Provider[]>([]);
const loading = ref(true);
const actionLoading = ref(false);

const googleLinked = () => providers.value.some((p) => p.provider === 'google');
const googleProvider = () =>
  providers.value.find((p) => p.provider === 'google');

onMounted(async () => {
  providers.value = await fetchLinkedProviders();
  loading.value = false;
});

async function handleUnlink() {
  actionLoading.value = true;

  const result = await unlinkGoogleAccount();
  actionLoading.value = false;

  if (result.ok) {
    providers.value = providers.value.filter((p) => p.provider !== 'google');
  } else {
    toast.error(result.error);
  }
}

async function handleLink() {
  actionLoading.value = true;

  const result = await initiateGoogleLink();

  // On success the page is already navigating to Google.
  if (!result.ok) {
    actionLoading.value = false;
    toast.error(result.error);
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="loading" class="flex justify-center p-4">
      <BaseSpinner on="ghost" size="20" />
    </div>

    <template v-else>
      <div class="flex max-sm:flex-col items-center justify-between gap-4 py-3">
        <div class="flex items-center max-sm:w-full gap-2">
          <div
            class="size-10 flex items-center justify-center flex-shrink-0"
            aria-hidden="true"
          >
            <AuthGoogleIcon :size="24" />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-base/5 font-semibold text-on-ghost">Google</span>
            <span v-if="googleLinked()" class="text-sm/4 text-on-ghost-muted">{{
              googleProvider()?.email
            }}</span>
          </div>
        </div>

        <BaseButton
          v-if="googleLinked()"
          variant="ghost"
          :loading="actionLoading"
          class="max-sm:w-full"
          @click="handleUnlink"
        >
          {{ t('auth.connected_accounts.actions.unlink') }}
        </BaseButton>

        <BaseButton
          v-else
          variant="action"
          :loading="actionLoading"
          class="max-sm:w-full"
          @click="handleLink"
        >
          {{ t('auth.connected_accounts.actions.link') }}
        </BaseButton>
      </div>
    </template>
  </div>
</template>
