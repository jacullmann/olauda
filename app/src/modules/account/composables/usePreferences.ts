import { computed } from 'vue';
import api, { unwrap } from '@/api/client';
import type { PreferencesDto, UpdatePreferencesDto } from '@/api/schema';
import { useTheme, type ThemeMode } from '@/common/composables/useTheme';
import { useSession } from '@/modules/auth/composables/useSession';
import i18n, { type SupportedLocale, LOCALE_KEY } from '@/i18n';

function applyLanguage(language: SupportedLocale): void {
  i18n.global.locale.value = language;
  localStorage.setItem(LOCALE_KEY, language);
  document.documentElement.setAttribute('lang', language);
}

/** Saves a change to the account's preferences. */
export function savePreferences(
  change: UpdatePreferencesDto,
): Promise<PreferencesDto> {
  return unwrap(api.PATCH('/user/preferences', { body: change }));
}

/** The theme and language, applied at once and kept with the account. */
export function usePreferences() {
  const { applyTheme, selectedThemeMode } = useTheme();
  const { isLoggedIn } = useSession();

  const currentTheme = computed(() => selectedThemeMode.value);
  const currentLanguage = computed(() => i18n.global.locale.value);

  function persist(change: UpdatePreferencesDto): void {
    if (!isLoggedIn.value) return;
    // Applied locally first; a failed save only costs the next device.
    savePreferences(change).catch(() => undefined);
  }

  function setTheme(theme: ThemeMode): void {
    applyTheme(theme);
    persist({ theme });
  }

  function setLanguage(language: SupportedLocale): void {
    applyLanguage(language);
    persist({ language });
  }

  /** Applies what the account saved, e.g. on another device. */
  function syncFromBackend({ theme, language }: PreferencesDto): void {
    if (theme && theme !== currentTheme.value) applyTheme(theme);
    if (language && language !== currentLanguage.value) {
      applyLanguage(language);
    }
  }

  return {
    currentTheme,
    currentLanguage,
    setTheme,
    setLanguage,
    syncFromBackend,
  };
}
