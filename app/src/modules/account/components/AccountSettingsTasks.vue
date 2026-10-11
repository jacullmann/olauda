<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePageSettings } from '@/modules/account/composables/usePageSettings';
import type { UnitOption } from '@/common/components/BaseSelect.vue';
import type { ArchiveCheckedTasks } from '@/modules/tasks/types';

const { t } = useI18n();
const { settings, updateSetting } = usePageSettings('tasks');

const ARCHIVE_CHECKED_OPTIONS: ArchiveCheckedTasks[] = [
  'always',
  'afterDueDate',
  'never',
];

const archiveCheckedOptions = computed<UnitOption[]>(() =>
  ARCHIVE_CHECKED_OPTIONS.map((value) => ({
    value,
    label: t(`auth.account_settings.tasks.archive_checked.options.${value}`),
  })),
);
</script>

<template>
  <div class="flex flex-col gap-8">
    <section class="flex flex-col gap-2">
      <h3>{{ t('auth.account_settings.tasks.list.title') }}</h3>

      <div class="flex flex-col max-md:-mx-6">
        <BaseList
          toggle
          :separator="false"
          :checked="settings.groupByDueDate"
          @update:checked="updateSetting('groupByDueDate', $event)"
        >
          <template #label>
            {{ t('auth.account_settings.tasks.group_by_due_date.title') }}
          </template>
          <template #desc>
            {{ t('auth.account_settings.tasks.group_by_due_date.description') }}
          </template>
        </BaseList>
      </div>
    </section>

    <section class="flex flex-col gap-2">
      <h3>{{ t('auth.account_settings.tasks.archive.title') }}</h3>

      <div class="flex flex-col max-md:-mx-6">
        <BaseList
          select
          :model-value="settings.archiveChecked"
          :options="archiveCheckedOptions"
          :title="t('auth.account_settings.tasks.archive_checked.title')"
          @update:model-value="
            updateSetting('archiveChecked', $event as ArchiveCheckedTasks)
          "
        >
          <template #label>
            {{ t('auth.account_settings.tasks.archive_checked.title') }}
          </template>
          <template #desc>
            {{ t('auth.account_settings.tasks.archive_checked.description') }}
          </template>
        </BaseList>

        <BaseList
          toggle
          :separator="false"
          :checked="settings.archiveOtherCoursesPastDue"
          @update:checked="updateSetting('archiveOtherCoursesPastDue', $event)"
        >
          <template #label>
            {{ t('auth.account_settings.tasks.archive_other_courses.title') }}
          </template>
          <template #desc>
            {{
              t('auth.account_settings.tasks.archive_other_courses.description')
            }}
          </template>
        </BaseList>
      </div>
    </section>
  </div>
</template>
