const UMAMI_SCRIPT_URL = 'https://cloud.umami.is/script.js';
const UMAMI_WEBSITE_ID = '5a9ea238-5aa1-4c7e-bf0f-d9577b223b3d';
const BEFORE_SEND_HOOK = 'umamiBeforeSend';

export interface UmamiPayload {
  url?: string;
  referrer?: string;
  [key: string]: unknown;
}

// Invite links carry their secret in the path, which the tracker's
// exclude-search/exclude-hash options cannot strip.
function redactInviteToken(url: string | undefined): string | undefined {
  return url?.replace(/\/invite\/[^/?#]+/, '/invite/:token');
}

/**
 * Loads Umami in production builds only. The hook is installed before the
 * tracker is inserted, so not even the first page view leaves unredacted.
 */
export function loadAnalytics(): void {
  if (!import.meta.env.PROD) return;

  window[BEFORE_SEND_HOOK] = (_type, payload) => ({
    ...payload,
    url: redactInviteToken(payload.url),
    referrer: redactInviteToken(payload.referrer),
  });

  const script = document.createElement('script');
  script.defer = true;
  script.src = UMAMI_SCRIPT_URL;
  script.dataset.websiteId = UMAMI_WEBSITE_ID;
  script.dataset.excludeSearch = 'true';
  script.dataset.excludeHash = 'true';
  script.dataset.beforeSend = BEFORE_SEND_HOOK;
  document.head.append(script);
}
