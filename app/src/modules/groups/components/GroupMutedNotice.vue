<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { MicOff } from '@lucide/vue';
import { useGroups } from '@/modules/groups/composables/useGroups';
import { useGroupPageId } from '@/modules/groups/composables/useGroupPageId';

const { t } = useI18n();
const { findGroup } = useGroups();
const groupId = useGroupPageId();

// Hidden only while the group stays open, so the reason for the missing
// actions comes back on the next visit.
const dismissed = ref(false);

const show = computed(
  () => findGroup(groupId)?.muted === true && !dismissed.value,
);
</script>

<template>
  <BaseNotice :show="show" :icon="MicOff" @dismiss="dismissed = true">
    {{ t('groups.muted.notice') }}
  </BaseNotice>
</template>
