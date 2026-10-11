<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePageSettings } from '@/modules/account/composables/usePageSettings';
import type { UnitOption } from '@/common/components/BaseSelect.vue';
import type { NowMarkerTime } from '@/modules/schedule/types';

const { t } = useI18n();
const { settings, updateSetting } = usePageSettings('schedule');

const NOW_MARKER_TIME_OPTIONS: NowMarkerTime[] = ['remaining', 'duration'];

const nowMarkerTimeOptions = computed<UnitOption[]>(() =>
  NOW_MARKER_TIME_OPTIONS.map((value) => ({
    value,
    label: t(`auth.account_settings.schedule.now_marker_time.options.${value}`),
  })),
);
</script>

<template>
  <div class="flex flex-col gap-8">
    <section class="flex flex-col gap-2">
      <h3>{{ t('auth.account_settings.schedule.today.title') }}</h3>

      <div class="flex flex-col max-md:-mx-6">
        <BaseList
          toggle
          :checked="settings.highlightNextLesson"
          @update:checked="updateSetting('highlightNextLesson', $event)"
        >
          <template #label>
            {{
              t('auth.account_settings.schedule.highlight_next_lesson.title')
            }}
          </template>
          <template #desc>
            {{
              t(
                'auth.account_settings.schedule.highlight_next_lesson.description',
              )
            }}
          </template>
        </BaseList>

        <BaseList
          toggle
          :separator="settings.nowMarker"
          :checked="settings.nowMarker"
          @update:checked="updateSetting('nowMarker', $event)"
        >
          <template #label>
            {{ t('auth.account_settings.schedule.now_marker.title') }}
          </template>
          <template #desc>
            {{ t('auth.account_settings.schedule.now_marker.description') }}
          </template>
        </BaseList>

        <BaseList
          v-if="settings.nowMarker"
          select
          :separator="false"
          :model-value="settings.nowMarkerTime"
          :options="nowMarkerTimeOptions"
          :title="t('auth.account_settings.schedule.now_marker_time.title')"
          @update:model-value="
            updateSetting('nowMarkerTime', $event as NowMarkerTime)
          "
        >
          <template #label>
            {{ t('auth.account_settings.schedule.now_marker_time.title') }}
          </template>
          <template #desc>
            {{
              t('auth.account_settings.schedule.now_marker_time.description')
            }}
          </template>
        </BaseList>
      </div>
    </section>

    <section class="flex flex-col gap-2">
      <h3>{{ t('auth.account_settings.schedule.free_time.title') }}</h3>

      <div class="flex flex-col max-md:-mx-6">
        <BaseList
          toggle
          :separator="false"
          :checked="settings.includeBreaksInFreeTime"
          @update:checked="updateSetting('includeBreaksInFreeTime', $event)"
        >
          <template #label>
            {{ t('auth.account_settings.schedule.include_breaks.title') }}
          </template>
          <template #desc>
            {{ t('auth.account_settings.schedule.include_breaks.description') }}
          </template>
        </BaseList>
      </div>
    </section>
  </div>
</template>
