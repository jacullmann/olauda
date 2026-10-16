<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { MicOff } from '@lucide/vue';
import { useGroups } from '@/modules/groups/composables/useGroups';
import { useGroupPageId } from '@/modules/groups/composables/useGroupPageId';

const { t } = useI18n();
const { findGroup } = useGroups();
const groupId = useGroupPageId();

// Stays for as long as the mute does: it is the only explanation for the
// actions missing from every page of the group.
const show = computed(() => findGroup(groupId)?.muted === true);
</script>

<template>
  <BaseNotice :show="show" :icon="MicOff" :dismissible="false">
    {{ t('groups.muted.notice') }}
  </BaseNotice>
</template>
