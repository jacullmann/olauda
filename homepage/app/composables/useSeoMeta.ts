export const useSeoMetaWithI18n = (options: {
  title: () => string;
  description: () => string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  structuredData?: Record<string, unknown>;
}) => {
  const { url: siteUrl } = useSiteConfig();
  const ogImage = options.ogImage ?? `${siteUrl}/og-image.png`;

  // Canonical, og:url and hreflang links come from useLocaleHead in the layout, so every locale keeps its own canonical URL.
  useSeoMeta({
    title: options.title,
    description: options.description,
    ogTitle: options.title,
    ogDescription: options.description,
    ogImage,
    ogType: options.ogType ?? 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: options.title,
    twitterDescription: options.description,
    twitterImage: ogImage,
  });

  if (options.structuredData) {
    useHead({
      script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(options.structuredData) }],
    });
  }
};
