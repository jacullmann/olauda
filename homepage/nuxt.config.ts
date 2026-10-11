import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
  compatibilityDate: '2026-04-05',
  devtools: { enabled: false },
  ssr: true,

  modules: [
    '@vueuse/nuxt',
    '@nuxtjs/color-mode',
    '@nuxtjs/sitemap',
    '@nuxtjs/i18n',
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  css: ['~/assets/css/main.css'],

  site: {
    url: 'https://schul-dashboard.com',
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
    baseUrl: 'https://schul-dashboard.com',
    locales: [
      {
        code: 'en',
        language: 'en-US',
        name: 'English',
        file: 'en.json'
      },
      {
        code: 'de',
        language: 'de-DE',
        name: 'Deutsch',
        file: 'de.json'
      },
    ],
    strategy: 'prefix_except_default',
    vueI18n: './i18n.config.ts',
    customRoutes: 'config',
    pages: {
      index: {
        en: '/',
        de: '/'
      },
      features: {
        en: '/features',
        de: '/funktionen'
      },
      about: {
        en: '/about',
        de: '/uber-uns'
      },
      contact: {
        en: '/contact',
        de: '/kontakt'
      },
      'legal-imprint': {
        en: '/legal/imprint',
        de: '/legal/impressum'
      },
      'legal-privacy-policy': {
        en: '/legal/privacy-policy',
        de: '/legal/datenschutz'
      },
      'legal-terms': {
        en: '/legal/terms',
        de: '/legal/nutzungsbedingungen'
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
      title: 'Olauda – Free School Management for Students',
      meta: [
        { name: 'description', content: 'The free, ad-free school management system by students for students. Homework, timetable, groups, and more – all in one place.' },
        { name: 'keywords', content: 'school dashboard, school management, homework, timetable, students, free, open source' },
        { name: 'author', content: 'Olauda' },
        { name: 'robots', content: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'Olauda – Free School Management for Students' },
        { property: 'og:description', content: 'The free, ad-free school management system by students for students.' },
        { property: 'og:image', content: 'https://schul-dashboard.com/og-image.png' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:site_name', content: 'Olauda' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Olauda – Free School Management' },
        { name: 'twitter:description', content: 'The free school management system by students for students.' },
        { name: 'twitter:image', content: 'https://schul-dashboard.com/og-image.png' },
        { name: 'theme-color', content: '#ffffff', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#0e0e0e', media: '(prefers-color-scheme: dark)' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'google-site-verification', content: 'EWIYTbU2hlYorTqIulVfAyKjArTsWmgQ9O9g0Tb0L8c' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      script: [
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
                '@id': 'https://schul-dashboard.com/#website',
                url: 'https://schul-dashboard.com/',
                name: 'Olauda',
                alternateName: ['schul-dashboard', 'Schul-Dashboard', 'Schuldashboard'],
                inLanguage: ['en-US', 'de-DE'],
                publisher: { '@id': 'https://schul-dashboard.com/#organization' },
              },
              {
                '@type': 'WebApplication',
                '@id': 'https://schul-dashboard.com/#webapp',
                url: 'https://app.schul-dashboard.com',
                name: 'Olauda',
                description: 'The free school management system by students for students',
                applicationCategory: 'EducationalApplication',
                operatingSystem: 'Web',
                offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
                publisher: { '@id': 'https://schul-dashboard.com/#organization' },
              },
              {
                '@type': 'Organization',
                '@id': 'https://schul-dashboard.com/#organization',
                name: 'Olauda',
                url: 'https://schul-dashboard.com/',
                logo: 'https://schul-dashboard.com/apple-touch-icon.png',
                email: 'kontakt@schul-dashboard.com',
                contactPoint: {
                  '@type': 'ContactPoint',
                  email: 'kontakt@schul-dashboard.com',
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
      appUrl: 'https://app.schul-dashboard.com',
      apiUrl: '',
    },
  },

  devServer: {
    host: '0.0.0.0',
    port: 3001,
  },
});
