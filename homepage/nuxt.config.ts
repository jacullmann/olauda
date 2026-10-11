import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
  compatibilityDate: '2026-04-05',
  devtools: { enabled: false },
  ssr: true,

  modules: ['@vueuse/nuxt', '@nuxtjs/color-mode', '@nuxtjs/sitemap', '@nuxtjs/i18n'],

  vite: {
    plugins: [tailwindcss()],
  },

  css: ['~/assets/css/main.css'],

  site: {
    url: 'https://olauda.com',
    name: 'Olauda',
  },

  colorMode: {
    preference: 'system',
    fallback: 'dark',
    globalName: '__NUXT_COLOR_MODE__',
    componentName: 'ColorScheme',
    classPrefix: '',
    classSuffix: '',
    storage: 'cookie',
    storageKey: 'nuxt-homepage-color-mode',
    cookieAttrs: {
      'max-age': '31536000',
      path: '/',
      sameSite: 'lax',
    },
  },

  i18n: {
    lazy: true,
    langDir: '../locales',
    defaultLocale: 'en',
    baseUrl: 'https://olauda.com',
    locales: [
      {
        code: 'en',
        language: 'en-US',
        name: 'English',
        files: ['en.json', 'legal.en.json'],
      },
      {
        code: 'de',
        language: 'de-DE',
        name: 'Deutsch',
        files: ['de.json', 'legal.de.json'],
      },
    ],
    strategy: 'prefix_except_default',
    vueI18n: './i18n.config.ts',
    customRoutes: 'config',
    pages: {
      index: {
        en: '/',
        de: '/',
      },
      features: {
        en: '/features',
        de: '/funktionen',
      },
      about: {
        en: '/about',
        de: '/uber-uns',
      },
      contact: {
        en: '/contact',
        de: '/kontakt',
      },
      'legal-imprint': {
        en: '/legal/imprint',
        de: '/legal/impressum',
      },
      'legal-privacy-policy': {
        en: '/legal/privacy-policy',
        de: '/legal/datenschutz',
      },
      'legal-terms': {
        en: '/legal/terms',
        de: '/legal/nutzungsbedingungen',
      },
    },
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      redirectOn: 'root',
    },
  },

  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: 'Olauda',
      meta: [
        {
          name: 'description',
          content:
            'Homework, exams and timetable changes in one place your whole class shares. Free and without ads.',
        },
        {
          name: 'keywords',
          content: 'homework planner, timetable, schedule changes, class, school, students, free',
        },
        { name: 'author', content: 'Olauda' },
        {
          name: 'robots',
          content: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
        },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'Olauda' },
        {
          property: 'og:description',
          content: 'Homework, exams and timetable changes in one place your whole class shares.',
        },
        { property: 'og:image', content: 'https://olauda.com/og-image.png' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:site_name', content: 'Olauda' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Olauda' },
        {
          name: 'twitter:description',
          content: 'Homework, exams and timetable changes in one place your whole class shares.',
        },
        { name: 'twitter:image', content: 'https://olauda.com/og-image.png' },
        { name: 'theme-color', content: '#ffffff', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#0f0f0f', media: '(prefers-color-scheme: dark)' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        {
          name: 'google-site-verification',
          content: 'EWIYTbU2hlYorTqIulVfAyKjArTsWmgQ9O9g0Tb0L8c',
        },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        {
          rel: 'preload',
          href: '/fonts/Satoshi-Variable.woff2',
          as: 'font',
          type: 'font/woff2',
          crossorigin: '',
        },
      ],
      script: [
        // Lets CSS hold the sample timetable back until the client has read the clock.
        { innerHTML: "document.documentElement.classList.add('js')" },
        {
          src: 'https://cloud.umami.is/script.js',
          defer: true,
          'data-website-id': '9e0ccaf1-08bb-4ab5-b42a-5f7a893090a6',
        },
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'WebSite',
                '@id': 'https://olauda.com/#website',
                url: 'https://olauda.com/',
                name: 'Olauda',
                inLanguage: ['en-US', 'de-DE'],
                publisher: { '@id': 'https://olauda.com/#organization' },
              },
              {
                '@type': 'WebApplication',
                '@id': 'https://olauda.com/#webapp',
                url: 'https://app.olauda.com',
                name: 'Olauda',
                description:
                  'Homework, exams and timetable changes in one place your whole class shares',
                applicationCategory: 'EducationalApplication',
                operatingSystem: 'Web',
                offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
                publisher: { '@id': 'https://olauda.com/#organization' },
              },
              {
                '@type': 'Organization',
                '@id': 'https://olauda.com/#organization',
                name: 'Olauda',
                url: 'https://olauda.com/',
                logo: 'https://olauda.com/apple-touch-icon.png',
                email: 'contact@olauda.com',
                contactPoint: {
                  '@type': 'ContactPoint',
                  email: 'contact@olauda.com',
                  contactType: 'customer support',
                },
              },
            ],
          }),
        },
      ],
    },
  },

  sitemap: {
    // Legal pages are noindex; listing them would only produce Search Console warnings.
    exclude: ['/legal/**', '/de/legal/**'],
  },

  routeRules: {
    '/product': { redirect: { to: '/features', statusCode: 301 } },
    '/de/produkt': { redirect: { to: '/de/funktionen', statusCode: 301 } },
  },

  runtimeConfig: {
    public: {
      appUrl: 'https://app.olauda.com',
      apiUrl: '',
    },
  },

  devServer: {
    host: '0.0.0.0',
    port: 3001,
  },
});
