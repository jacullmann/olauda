export interface ParsedUserAgent {
  browser: string | null;
  os: string | null;
  isMobile: boolean;
}

/** Best-effort browser and OS names for showing a device to its owner. */
export function parseUserAgent(ua: string | null): ParsedUserAgent {
  if (!ua) return { browser: null, os: null, isMobile: false };

  const uaLower = ua.toLowerCase();

  return {
    browser: browserName(uaLower),
    os: osName(uaLower),
    isMobile: /mobile|android|iphone|ipad|phone/i.test(uaLower),
  };
}

function osName(ua: string): string | null {
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('macintosh') || ua.includes('mac os x')) {
    if (ua.includes('iphone')) return 'iOS';
    if (ua.includes('ipad')) return 'iPadOS';
    return 'macOS';
  }
  if (ua.includes('android')) return 'Android';
  if (ua.includes('linux')) return 'Linux';
  if (ua.includes('iphone')) return 'iOS';
  if (ua.includes('ipad')) return 'iPadOS';
  if (ua.includes('cros')) return 'ChromeOS';
  return null;
}

// Edge's product token differs per platform: Edg/ on desktop, EdgA/ on Android, EdgiOS/ on iOS.
const EDGE_TOKENS = ['edg/', 'edga/', 'edgios/'] as const;

function browserName(ua: string): string | null {
  if (EDGE_TOKENS.some((token) => ua.includes(token))) return 'Microsoft Edge';
  if (ua.includes('opera') || ua.includes('opr/')) return 'Opera';
  if (ua.includes('chrome') || ua.includes('crios')) return 'Google Chrome';
  if (ua.includes('firefox') || ua.includes('fxios')) return 'Mozilla Firefox';
  if (ua.includes('safari')) return 'Apple Safari';
  return null;
}
