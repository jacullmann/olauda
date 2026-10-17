<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { useOAuth } from '@/modules/auth/composables/useOAuth';
import AuthGoogleIcon from '@/modules/auth/components/AuthGoogleIcon.vue';
import { useToast } from '@/common/composables/useToast';
import {
  accountKeys,
  linkedProvidersQuery,
} from '@/modules/account/utils/accountQueries';

const { t } = useI18n();
const toast = useToast();
const queryClient = useQueryClient();

const { unlinkGoogleAccount, initiateGoogleLink } = useOAuth();

const { data: providers, isPending: loading } = useQuery(
  linkedProvidersQuery(),
);
const actionLoading = ref(false);

const googleProvider = computed(() =>
  providers.value?.find((p) => p.provider === 'google'),
);
const googleLinked = () => googleProvider.value !== undefined;

async function handleUnlink() {
  actionLoading.value = true;
  const result = await unlinkGoogleAccount();
  await queryClient.invalidateQueries({ queryKey: accountKeys.all });
  actionLoading.value = false;

  if (!result.ok) toast.error(result.error);
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
              googleProvider?.email
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
