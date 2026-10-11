<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGroups } from '@/modules/groups/composables/useGroups';
import type { PermissionKey } from '@/modules/groups/types';

const props = defineProps<{
  /** Groups lacking this permission are listed but cannot be picked. */
  permission?: PermissionKey;
}>();

const groupId = defineModel<string>({ required: true });

const { t } = useI18n();
const { userGroups } = useGroups();

const options = computed(() =>
  userGroups.value.map((group) => ({
    label: group.name,
    value: group.id,
    disabled:
      !!props.permission &&
      !group.effectivePermissions.includes(props.permission),
  })),
);

const avatarByGroupId = computed(
  () => new Map(userGroups.value.map((g) => [g.id, g.avatarUrl ?? null])),
);
</script>

<template>
  <BaseSelect
    v-model="groupId"
    :options="options"
    :form="false"
    :title="t('common.selection.group')"
    class="min-w-0"
    classes="w-48! max-w-full pl-2! min-h-0! -my-0.5"
  >
    <template #icon="{ option, size }">
      <BaseAvatar
        :name="option.label"
        :picture="avatarByGroupId.get(option.value)"
        :size="size / 4"
      />
    </template>
  </BaseSelect>
</template>
