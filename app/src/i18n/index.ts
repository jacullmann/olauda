import { createI18n } from 'vue-i18n';
import de from '@/i18n/locales/de';
import en from '@/i18n/locales/en';

const LOCALE_KEY = 'user-locale';
const SUPPORTED_LOCALES = ['de', 'en'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const isSupportedLocale = (value: string): value is SupportedLocale =>
  (SUPPORTED_LOCALES as readonly string[]).includes(value);

function getInitialLocale(): SupportedLocale {
  try {
    const saved = localStorage.getItem(LOCALE_KEY) as SupportedLocale | null;
    if (saved && SUPPORTED_LOCALES.includes(saved)) {
      return saved;
    }

    const browserLang = navigator.language?.split('-')[0] as SupportedLocale;
    if (SUPPORTED_LOCALES.includes(browserLang)) {
      localStorage.setItem(LOCALE_KEY, browserLang);
      return browserLang;
    }
  } catch (error) {
    console.warn('Could not access localStorage:', error);
  }

  try {
    localStorage.setItem(LOCALE_KEY, 'en');
  } catch {
    // Private mode or blocked storage: fall through to the default locale.
  }
  return 'en';
}

const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'en',
  messages: {
    de,
    en,
  },
});

export default i18n;
export { SUPPORTED_LOCALES, LOCALE_KEY };
export type { SupportedLocale };
