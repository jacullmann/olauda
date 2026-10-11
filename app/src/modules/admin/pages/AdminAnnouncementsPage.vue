<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Pencil, Plus, Trash2 } from '@lucide/vue';
import AdminSystemAnnouncementFormModal from '@/modules/admin/components/AdminSystemAnnouncementFormModal.vue';
import { useAdminAnnouncements } from '@/modules/admin/composables/useAdminAnnouncements';
import { useAdminFormat } from '@/modules/admin/composables/useAdminFormat';
import type { AdminSystemAnnouncement } from '@/modules/admin/types';

const { active, scheduled, loading, load, remove } = useAdminAnnouncements();
const { fmtDateTime } = useAdminFormat();
const { t } = useI18n();

const sections = computed(() =>
  [
    { status: 'active', announcements: active.value },
    { status: 'scheduled', announcements: scheduled.value },
  ].filter((section) => section.announcements.length > 0),
);
const isEmpty = computed(() => sections.value.length === 0);

/** What a row tells about an announcement besides its text. */
function detailsOf(a: AdminSystemAnnouncement): string[] {
  const start = fmtDateTime(a.startsAt);
  const timeframe = a.endsAt
    ? t(`admin.announcements.timeframe.${a.status}_until`, {
        start,
        end: fmtDateTime(a.endsAt),
      })
    : t(`admin.announcements.timeframe.${a.status}`, { start });

  return [
    timeframe,
    ...(a.endsAt ? [] : [t('admin.announcements.timeframe.no_end')]),
    ...(a.status === 'active'
      ? [t('admin.announcements.read_count', a.readCount)]
      : []),
    ...(a.authorEmail ? [a.authorEmail] : []),
  ];
}

const formOpen = ref(false);
/** Remounts the form, so each opening starts from a fresh draft. */
const formKey = ref(0);
const editing = ref<AdminSystemAnnouncement | null>(null);

function openForm(announcement: AdminSystemAnnouncement | null) {
  editing.value = announcement;
  formKey.value += 1;
  formOpen.value = true;
}

async function onSaved() {
  formOpen.value = false;
  await load();
}

onMounted(load);
</script>

<template>
  <BasePageHeader>
    {{ t('admin.announcements.title') }}
    <template #action>
      <BaseTooltip
        :content="t('admin.announcements.create_button')"
        placement="bottom"
      >
        <BaseButton
          variant="action"
          :icon="Plus"
          icon-classes="size-6"
          :aria-label="t('admin.announcements.create_button')"
          @click="openForm(null)"
        />
      </BaseTooltip>
    </template>
  </BasePageHeader>

  <div v-if="loading && isEmpty" class="flex justify-center p-10">
    <BaseSpinner on="ghost" size="24px" />
  </div>
  <div v-else-if="isEmpty" class="text-center text-on-ghost-muted p-10">
    {{ t('admin.announcements.empty') }}
  </div>
  <div v-else class="flex flex-col gap-8">
    <section
      v-for="section in sections"
      :key="section.status"
      class="flex flex-col gap-1"
    >
      <h3>{{ t(`admin.announcements.sections.${section.status}`) }}</h3>
      <ul class="flex flex-col divide-y divide-ghost-border">
        <li
          v-for="a in section.announcements"
          :key="a.id"
          class="flex items-center gap-3 py-3"
        >
          <div class="flex flex-col flex-1 min-w-0 gap-1">
            <div class="text-base text-on-ghost break-words">
              {{ a.content }}
            </div>
            <div class="flex flex-wrap gap-x-1 text-sm text-on-ghost-muted">
              <template v-if="a.important">
                <span class="font-bold text-danger">{{
                  t('announcements.list.important')
                }}</span>
                <span aria-hidden="true">·</span>
              </template>
              <template v-for="(detail, i) in detailsOf(a)" :key="i">
                <span v-if="i > 0" aria-hidden="true">·</span>
                <span class="min-w-0 break-words">{{ detail }}</span>
              </template>
            </div>
          </div>
          <BaseRow class="shrink-0">
            <BaseTooltip
              v-if="a.status === 'scheduled'"
              :content="t('common.buttons.edit')"
              placement="bottom"
            >
              <BaseButton
                size="sm"
                :icon="Pencil"
                :aria-label="t('common.buttons.edit')"
                @click="openForm(a)"
              />
            </BaseTooltip>
            <BaseTooltip
              :content="t('common.buttons.delete')"
              placement="bottom"
            >
              <BaseButton
                size="sm"
                :icon="Trash2"
                :aria-label="t('common.buttons.delete')"
                @click="remove(a)"
              />
            </BaseTooltip>
          </BaseRow>
        </li>
      </ul>
    </section>
  </div>

  <AdminSystemAnnouncementFormModal
    v-if="formKey"
    :key="formKey"
    :open="formOpen"
    :announcement="editing"
    @cancel="formOpen = false"
    @saved="onSaved"
  />
</template>
