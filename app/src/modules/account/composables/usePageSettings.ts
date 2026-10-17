import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiErrorMessage } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { savePreferences } from '@/modules/account/composables/usePreferences';
import {
  useUserStore,
  type PageSettings,
  type SettingsPage,
} from '@/modules/account/stores/useUserStore';

// How the pages behaved before they had settings, so members who never change
// them see no difference.
const DEFAULT_PAGE_SETTINGS: PageSettings = {
  dashboard: {
    tagline: true,
  },
  tasks: {
    archiveChecked: 'afterDueDate',
    groupByDueDate: true,
    archiveOtherCoursesPastDue: true,
  },
  schedule: {
    highlightNextLesson: true,
    nowMarker: true,
    nowMarkerTime: 'remaining',
    includeBreaksInFreeTime: true,
  },
};

/** A page's settings as the member chose them, the defaults filling the rest. */
export function usePageSettings<P extends SettingsPage>(page: P) {
  const userStore = useUserStore();
  const toast = useToast();
  const { t } = useI18n();

  const settings = computed<PageSettings[P]>(() => ({
    ...DEFAULT_PAGE_SETTINGS[page],
    ...userStore.storedPageSettings(page),
  }));

  /** Applied right away and undone if the server refuses it. */
  async function updateSetting<K extends keyof PageSettings[P]>(
    key: K,
    value: PageSettings[P][K],
  ): Promise<void> {
    const previous = userStore.user?.preferences;
    if (!previous) return;
    userStore.setPageSetting(page, key, value);
    try {
      await savePreferences({ [page]: { [key]: value } });
    } catch (err: unknown) {
      userStore.updateUser({ preferences: previous });
      toast.error(apiErrorMessage(err, t('auth.account_settings.errors.save')));
    }
  }

  return { settings, updateSetting };
}
