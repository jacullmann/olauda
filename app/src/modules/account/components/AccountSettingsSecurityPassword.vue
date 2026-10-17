<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { KeyRound } from '@lucide/vue';
import { useToast } from '@/common/composables/useToast';
import { useSignInMethods } from '@/modules/account/composables/useSignInMethods';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import { useUserStore } from '@/modules/account/stores/useUserStore';

const { t } = useI18n();
const router = useRouter();
const toast = useToast();
const confirmModal = useConfirmModal();
const { hasPassword } = storeToRefs(useUserStore());
const { removing, canRemovePassword, removePassword } = useSignInMethods();

function openPasswordForm() {
  void router.push({ name: 'account-password-edit' });
}

async function confirmRemovePassword() {
  const confirmed = await confirmModal.ask({
    title: t('auth.remove_password.title'),
    content: t('auth.remove_password.warning'),
    submitText: t('auth.remove_password.submit'),
    danger: true,
  });
  if (!confirmed) return;

  const result = await removePassword();
  if (!result.ok && result.error) toast.error(result.error);
}
</script>

<template>
  <BaseFormContent>
    <div class="flex items-center gap-2 p-3 mx-auto">
      <div
        class="flex items-center justify-center size-11"
        :class="hasPassword ? 'text-success' : 'text-on-ghost-muted'"
      >
        <KeyRound :size="32" />
      </div>
      <div class="flex flex-col">
        <span class="text-sm text-on-ghost-muted">
          {{ t('auth.security.password') }}
        </span>
        <span
          class="text-base font-bold"
          :class="hasPassword ? 'text-on-ghost' : 'text-on-ghost-muted'"
        >
          {{
            hasPassword
              ? t('auth.security.password_set')
              : t('auth.security.password_not_set')
          }}
        </span>
      </div>
    </div>
    <p class="text-sm/relaxed text-on-ghost-muted m-0! font-sans">
      {{
        hasPassword
          ? t('auth.security.password_description')
          : t('auth.security.password_description_unset')
      }}
    </p>

    <BaseButton variant="action" full @click="openPasswordForm">
      {{
        hasPassword
          ? t('auth.change_password.title')
          : t('auth.set_password.title')
      }}
    </BaseButton>

    <template v-if="hasPassword && canRemovePassword">
      <p class="text-sm/relaxed text-on-ghost-muted m-0! font-sans">
        {{ t('auth.remove_password.description') }}
      </p>
      <BaseButton
        variant="danger"
        full
        :disabled="removing"
        @click="confirmRemovePassword"
      >
        {{ t('auth.remove_password.submit') }}
      </BaseButton>
    </template>
  </BaseFormContent>
</template>
