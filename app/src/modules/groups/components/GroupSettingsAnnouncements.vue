<script setup lang="ts">
import { Plus, Trash2 } from '@lucide/vue';
import { useAnnouncementFormModal } from '@/modules/announcements/stores/useAnnouncementFormModal';
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { useGroups } from '@/modules/groups/composables/useGroups';
import { useGroupPageId } from '@/modules/groups/composables/useGroupPageId';
import { useGroupAnnouncementsAdmin } from '@/modules/groups/composables/useGroupAnnouncementsAdmin';
import AnnouncementList from '@/modules/announcements/components/AnnouncementList.vue';
import { fromGroupAnnouncement } from '@/modules/announcements/composables/useAnnouncementFeed';

const groupId = useGroupPageId();
const { announcements, deleteAnnouncement } = useGroupAnnouncementsAdmin();
const listedAnnouncements = computed(() =>
  announcements.value.map(fromGroupAnnouncement),
);

const { t } = useI18n();

const announcementFormModal = useAnnouncementFormModal();

const { checkPermission } = useGroups();
const canManageAnnouncements = computed(() =>
  checkPermission('manage_announcements'),
);
</script>

<template>
  <div class="flex flex-1 flex-col">
    <BasePageHeader>
      <template #action>
        <BaseTooltip
          v-if="canManageAnnouncements"
          :content="t('announcements.list.create_button')"
          placement="bottom"
        >
          <BaseButton
            variant="action"
            :icon="Plus"
            icon-classes="size-6"
            @click="announcementFormModal.openFor(groupId, { local: true })"
          />
        </BaseTooltip>
      </template>
    </BasePageHeader>

    <AnnouncementList class="flex-1" :announcements="listedAnnouncements">
      <template #actions="{ announcement }">
        <BaseTooltip
          v-if="canManageAnnouncements"
          :content="t('common.buttons.delete')"
          placement="bottom"
        >
          <BaseButton
            variant="ghost"
            size="sm"
            :icon="Trash2"
            @click="deleteAnnouncement(announcement.id)"
          />
        </BaseTooltip>
      </template>
    </AnnouncementList>
  </div>
</template>
