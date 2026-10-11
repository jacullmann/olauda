<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Plus } from '@lucide/vue';
import { useAnnouncementFormModal } from '@/modules/announcements/stores/useAnnouncementFormModal';
import { useAnnouncementListModal } from '@/modules/announcements/stores/useAnnouncementListModal';
import { useGroups } from '@/modules/groups/composables/useGroups';
import type { MorphOrigin } from '@/common/utils/morph';
import AnnouncementList from './AnnouncementList.vue';
import { useAnnouncementFeed } from '@/modules/announcements/composables/useAnnouncementFeed';

defineProps<{
  open: boolean;
  origin: MorphOrigin | null;
}>();

defineEmits<{
  (e: 'cancel'): void;
}>();

const { t } = useI18n();
const { groupAnnouncements } = useAnnouncementFeed();
const { activeGroupId, checkPermission } = useGroups();
const announcementsModal = useAnnouncementListModal();
const announcementForm = useAnnouncementFormModal();

function createAnnouncement() {
  if (!activeGroupId.value) return;
  announcementsModal.close();
  announcementForm.openFor(activeGroupId.value, { local: true });
}
</script>

<template>
  <BaseModal :open="open" :origin="origin" sheet @cancel="$emit('cancel')">
    <template #title>
      {{ t('announcements.list.title') }}
    </template>

    <template #content>
      <BaseButton
        v-if="checkPermission('manage_announcements')"
        variant="action"
        :icon="Plus"
        full
        class="mb-4"
        @click="createAnnouncement"
      >
        {{ t('announcements.list.create_button') }}
      </BaseButton>

      <AnnouncementList :announcements="groupAnnouncements" />
    </template>
  </BaseModal>
</template>
