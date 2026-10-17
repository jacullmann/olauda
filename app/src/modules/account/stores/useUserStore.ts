import { defineStore } from 'pinia';
import { computed, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { queryClient } from '@/api/queryClient';
import type {
  CurrentUserDto,
  DismissibleNotice,
  PreferencesDto,
} from '@/api/schema';
import {
  accountKeys,
  currentUserQuery,
} from '@/modules/account/utils/accountQueries';
import { usePreferences } from '@/modules/account/composables/usePreferences';
import { useSession } from '@/modules/auth/composables/useSession';
import type { TaskPreferences } from '@/modules/tasks/types';
import type { SchedulePreferences } from '@/modules/schedule/types';
import type { DashboardPreferences } from '@/modules/dashboard/types';

export type { DismissibleNotice };

export type UserData = CurrentUserDto;

/** The settings each page has, every one of them set. */
export interface PageSettings {
  dashboard: DashboardPreferences;
  tasks: TaskPreferences;
  schedule: SchedulePreferences;
}

export type SettingsPage = keyof PageSettings;

/**
 * The signed-in user as the API last described them. The profile is server
 * state cached under `accountKeys.me()`; this store only names what the app
 * reads from it and applies local changes to that cache.
 */
export const useUserStore = defineStore('user', () => {
  const { isLoggedIn: hasSession } = useSession();
  const profile = useQuery(
    { ...currentUserQuery(), enabled: hasSession },
    queryClient,
  );

  const user = computed<UserData | null>(() =>
    hasSession.value ? (profile.data.value ?? null) : null,
  );

  const isLoggedIn = computed(() => user.value !== null);
  const isSuperadmin = computed(() => user.value?.role === 'superadmin');
  const mfaEnabled = computed(() => user.value?.mfaEnabled === true);
  // Google-only accounts have no password until they set one.
  const hasPassword = computed(() => user.value?.hasPassword !== false);

  const { syncFromBackend } = usePreferences();
  watch(
    () => user.value?.preferences,
    (preferences) => preferences && syncFromBackend(preferences),
  );

  /**
   * Loads the profile again, e.g. right after signing in. A failed load keeps
   * the profile as it was; the route guard asks again on the next navigation.
   */
  async function fetchUser(): Promise<void> {
    await queryClient
      .fetchQuery({ ...currentUserQuery(), staleTime: 0 })
      .catch(() => undefined);
  }

  /** Mirrors a change the server accepted, or is about to accept. */
  function updateUser(change: Partial<UserData>): void {
    queryClient.setQueryData<UserData | null>(
      accountKeys.me(),
      (current) => current && { ...current, ...change },
    );
  }

  function updatePreferences(
    change: (preferences: PreferencesDto) => Partial<PreferencesDto>,
  ): void {
    const preferences = user.value?.preferences;
    if (preferences) {
      updateUser({ preferences: { ...preferences, ...change(preferences) } });
    }
  }

  function isNoticeDismissed(notice: DismissibleNotice): boolean {
    return user.value?.preferences.dismissedNotices.includes(notice) ?? false;
  }

  function markNoticeDismissed(notice: DismissibleNotice): void {
    if (isNoticeDismissed(notice)) return;
    updatePreferences(({ dismissedNotices }) => ({
      dismissedNotices: [...dismissedNotices, notice],
    }));
  }

  /** Only what the member changed is stored; the defaults fill in the rest. */
  function storedPageSettings<P extends SettingsPage>(
    page: P,
  ): Partial<PageSettings[P]> {
    const stored = user.value?.preferences[page] ?? {};
    // The API sends unchanged settings as absent or `null`.
    return Object.fromEntries(
      Object.entries(stored).filter(([, value]) => value != null),
    ) as Partial<PageSettings[P]>;
  }

  function setPageSetting<
    P extends SettingsPage,
    K extends keyof PageSettings[P],
  >(page: P, key: K, value: PageSettings[P][K]): void {
    updatePreferences((preferences) => ({
      [page]: { ...preferences[page], [key]: value },
    }));
  }

  return {
    user,
    isLoggedIn,
    isSuperadmin,
    mfaEnabled,
    hasPassword,
    fetchUser,
    updateUser,
    isNoticeDismissed,
    markNoticeDismissed,
    storedPageSettings,
    setPageSetting,
  };
});
