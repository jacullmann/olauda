import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

type LegalPage = 'imprint' | 'privacy' | 'terms';

// Legal pages live on the homepage; paths mirror its i18n customRoutes in homepage/nuxt.config.ts.
const DEFAULT_LEGAL_PATHS: Record<LegalPage, string> = {
  imprint: '/legal/imprint',
  privacy: '/legal/privacy-policy',
  terms: '/legal/terms',
};

const LEGAL_PATHS: Record<string, Record<LegalPage, string>> = {
  en: DEFAULT_LEGAL_PATHS,
  de: {
    imprint: '/de/legal/impressum',
    privacy: '/de/legal/datenschutz',
    terms: '/de/legal/nutzungsbedingungen',
  },
};

const HOMEPAGE_URL = (import.meta.env.VITE_HOMEPAGE_URL as string).replace(
  /\/$/,
  '',
);

export function useLegalLinks() {
  const { locale } = useI18n();

  const paths = computed(
    () => LEGAL_PATHS[locale.value] ?? DEFAULT_LEGAL_PATHS,
  );

  const imprintUrl = computed(() => `${HOMEPAGE_URL}${paths.value.imprint}`);
  const privacyPolicyUrl = computed(
    () => `${HOMEPAGE_URL}${paths.value.privacy}`,
  );
  const termsUrl = computed(() => `${HOMEPAGE_URL}${paths.value.terms}`);

  return { imprintUrl, privacyPolicyUrl, termsUrl };
}
