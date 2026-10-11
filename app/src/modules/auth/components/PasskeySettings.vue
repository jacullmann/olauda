<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, Check, Pencil, Plus, Trash2, X } from '@lucide/vue';
import { passkeyIcon } from '@/modules/auth/utils/passkeyIcon';
import { usePasskeys } from '@/modules/auth/composables/usePasskeys';
import type { Passkey } from '@/modules/auth/types';
import { useConfirmModal } from '@/stores/modalStore';
import { useToast } from '@/common/composables/useToast';
import { formatDate } from '@/utils/date-formatter';

/** Mirrors the server's PASSKEY_NAME_MAX_CHARS. */
const NAME_MAX_LENGTH = 64;

const { t } = useI18n();
const toast = useToast();
const confirmModal = useConfirmModal();

const {
  supported,
  passkeys,
  loading,
  loadFailed,
  fetchPasskeys,
  addPasskey,
  renamePasskey,
  removePasskey,
} = usePasskeys();

const adding = ref(false);
const editingId = ref<string | null>(null);
const draftName = ref('');
const saving = ref(false);
const removingId = ref<string | null>(null);

let renameInput: { focus: () => void; select: () => void } | null = null;

function setRenameInput(el: unknown) {
  renameInput = el as typeof renameInput;
}

async function handleAdd() {
  adding.value = true;
  const result = await addPasskey();
  adding.value = false;

  if (!result.ok && !result.dismissed) toast.error(result.error);
}

async function startRename(passkey: Passkey) {
  editingId.value = passkey.id;
  draftName.value = passkey.name;
  await nextTick();
  renameInput?.focus();
  renameInput?.select();
}

function cancelRename() {
  editingId.value = null;
  draftName.value = '';
}

async function saveRename(passkey: Passkey) {
  const name = draftName.value.trim();
  if (!name || name === passkey.name) {
    cancelRename();
    return;
  }

  saving.value = true;
  const result = await renamePasskey(passkey, name);
  saving.value = false;

  if (result.ok) {
    cancelRename();
  } else if (!result.dismissed) {
    toast.error(result.error);
  }
}

async function handleRemove(passkey: Passkey) {
  const confirmed = await confirmModal.ask({
    title: t('auth.passkeys.remove_modal.title'),
    content: t('auth.passkeys.remove_modal.message', { name: passkey.name }),
    submitText: t('auth.passkeys.remove_modal.submit'),
    danger: true,
  });
  if (!confirmed) return;

  removingId.value = passkey.id;
  const result = await removePasskey(passkey);
  removingId.value = null;

  if (!result.ok && !result.dismissed) toast.error(result.error);
}

function usageLabel(passkey: Passkey): string {
  const added = t('auth.passkeys.added_at', {
    date: formatDate(passkey.createdAt, t),
  });
  const used = passkey.lastUsedAt
    ? t('auth.passkeys.last_used_at', {
        date: formatDate(passkey.lastUsedAt, t),
      })
    : t('auth.passkeys.never_used');
  return `${added} • ${used}`;
}

onMounted(() => {
  void fetchPasskeys();
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-sm/relaxed text-on-ghost-muted m-0!">
      {{ t('auth.passkeys.description') }}
    </p>

    <div
      v-if="!supported"
      class="flex items-center gap-2 p-3 bg-surface border border-ghost-border rounded-xl text-sm text-on-ghost-muted"
    >
      <AlertCircle :size="20" class="shrink-0" />
      {{ t('auth.passkeys.unsupported') }}
    </div>

    <div v-if="loadFailed" class="flex justify-center">
      <BaseButton variant="ghost" @click="fetchPasskeys">
        {{ t('auth.sessions.actions.retry') }}
      </BaseButton>
    </div>

    <div v-else-if="loading" class="flex flex-col">
      <template v-for="i in 2" :key="i">
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
      <p
        v-if="passkeys.length === 0"
        class="text-sm text-on-ghost-muted text-center m-0! py-2"
      >
        {{ t('auth.passkeys.empty') }}
      </p>

      <div v-else class="flex flex-col">
        <template v-for="(passkey, index) in passkeys" :key="passkey.id">
          <div v-if="index > 0" class="separator ml-13"></div>
          <div class="flex gap-3 items-center py-3">
            <div
              class="flex items-center justify-center size-10 text-on-ghost-muted shrink-0"
              aria-hidden="true"
            >
              <component :is="passkeyIcon" :size="24" />
            </div>

            <form
              v-if="editingId === passkey.id"
              class="flex flex-1 min-w-0 items-center gap-2"
              @submit.prevent="saveRename(passkey)"
            >
              <BaseInput
                :id="`passkey-name-${passkey.id}`"
                :ref="setRenameInput"
                v-model="draftName"
                :maxlength="NAME_MAX_LENGTH"
                :aria-label="t('auth.passkeys.name_label')"
                required
                @keydown.esc.prevent="cancelRename"
              />
              <BaseTooltip
                :content="t('common.buttons.save')"
                placement="bottom"
              >
                <BaseButton
                  type="submit"
                  variant="ghost"
                  on="ghost"
                  :icon="Check"
                  :loading="saving"
                  :aria-label="t('common.buttons.save')"
                />
              </BaseTooltip>
              <BaseTooltip
                :content="t('common.buttons.cancel')"
                placement="bottom"
              >
                <BaseButton
                  variant="ghost"
                  on="ghost"
                  :icon="X"
                  :aria-label="t('common.buttons.cancel')"
                  @click="cancelRename"
                />
              </BaseTooltip>
            </form>

            <template v-else>
              <div class="flex flex-col flex-1 min-w-0">
                <span class="text-base font-semibold text-on-ghost truncate">
                  {{ passkey.name }}
                </span>
                <span class="text-sm text-on-ghost-muted">
                  {{ usageLabel(passkey) }}
                </span>
              </div>

              <BaseTooltip
                :content="t('auth.passkeys.rename')"
                placement="bottom"
              >
                <BaseButton
                  variant="ghost"
                  on="ghost"
                  :icon="Pencil"
                  :aria-label="t('auth.passkeys.rename')"
                  @click="startRename(passkey)"
                />
              </BaseTooltip>
              <BaseTooltip
                :content="t('auth.passkeys.remove')"
                placement="bottom"
              >
                <BaseButton
                  variant="ghost"
                  on="ghost"
                  :icon="Trash2"
                  :loading="removingId === passkey.id"
                  :aria-label="t('auth.passkeys.remove')"
                  @click="handleRemove(passkey)"
                />
              </BaseTooltip>
            </template>
          </div>
        </template>
      </div>

      <BaseButton
        v-if="supported"
        variant="action"
        full
        :icon="Plus"
        :loading="adding"
        :disabled="adding"
        @click="handleAdd"
      >
        {{ t('auth.passkeys.add') }}
      </BaseButton>
    </template>
  </div>
</template>
