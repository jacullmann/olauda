<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  open: boolean;
  groupName: string;
  loading?: boolean;
  memberCount?: number;
  itemCount?: number;
}>();

const emit = defineEmits<{
  (e: 'cancel'): void;
  (e: 'confirm'): void;
}>();

const { t } = useI18n();

const CONSEQUENCE_KEYS = ['content', 'schedule', 'members', 'invites'] as const;

const confirmationInput = ref('');

watch(
  () => props.open,
  (open) => {
    if (open) confirmationInput.value = '';
  },
);

const nameMatches = computed(
  () => confirmationInput.value.trim() === props.groupName.trim(),
);

const hasCounts = computed(
  () => props.memberCount !== undefined && props.itemCount !== undefined,
);

function cancel() {
  if (!props.loading) emit('cancel');
}

// The submit button is disabled until the name matches, but Enter can still
// reach the form, so the check is repeated here.
function submit() {
  if (nameMatches.value && !props.loading) emit('confirm');
}
</script>

<template>
  <BaseModal
    :open="open"
    :submit="submit"
    :loading="loading"
    danger
    :requirement="nameMatches"
    @cancel="cancel"
  >
    <template #title>
      {{ t('groups.delete_modal.title') }}
    </template>

    <template #content>
      <div class="bg-danger-hover border border-danger rounded-xl px-3 py-2">
        <strong class="font-sans text-lg text-danger block mb-2">{{
          t('groups.delete_modal.warn_title', { name: groupName })
        }}</strong>
        <p v-if="hasCounts" class="text-sm text-on-ghost font-bold m-0 mb-2">
          {{
            t('groups.delete_modal.counts', {
              members: t(
                'groups.delete_modal.counts_members',
                memberCount ?? 0,
              ),
              items: t('groups.delete_modal.counts_items', itemCount ?? 0),
            })
          }}
        </p>
        <ul class="text-sm/relaxed text-on-ghost m-0 pl-5 list-disc">
          <li v-for="key in CONSEQUENCE_KEYS" :key="key">
            {{ t(`groups.delete_modal.consequences.${key}`) }}
          </li>
        </ul>
        <p class="text-sm/relaxed text-on-ghost font-bold m-0 mt-2">
          {{ t('groups.delete_modal.irreversible') }}
        </p>
      </div>

      <BaseFormGroup id="delete-group-confirm">
        <BaseLabel for="delete-group-confirm">
          <i18n-t keypath="groups.delete_modal.confirmation_label">
            <template #name>
              <strong class="select-all">{{ groupName }}</strong>
            </template>
          </i18n-t>
        </BaseLabel>
        <BaseInput
          id="delete-group-confirm"
          v-model="confirmationInput"
          type="text"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :placeholder="groupName"
        />
      </BaseFormGroup>
    </template>

    <template #action-text>
      {{ t('groups.delete_modal.submit') }}
    </template>
  </BaseModal>
</template>
