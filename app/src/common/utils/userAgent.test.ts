import { describe, expect, it } from 'vitest';
import { parseUserAgent } from './userAgent';

describe('parseUserAgent', () => {
  it('names desktop browsers and systems', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
      ),
    ).toEqual({ browser: 'Microsoft Edge', os: 'Windows', isMobile: false });
  });

  it('names Edge on Android and iOS too', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 EdgA/141.0.0.0',
      ),
    ).toEqual({ browser: 'Microsoft Edge', os: 'Android', isMobile: true });
    expect(
      parseUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/141.0.0.0 Mobile/15E148 Safari/604.1',
      ),
    ).toEqual({ browser: 'Microsoft Edge', os: 'iOS', isMobile: true });
  });

  it('tells iOS Safari apart from macOS', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toEqual({ browser: 'Apple Safari', os: 'iOS', isMobile: true });
  });

  it('leaves unknown parts empty', () => {
    expect(parseUserAgent(null)).toEqual({
      browser: null,
      os: null,
      isMobile: false,
    });
    expect(parseUserAgent('curl/8.0')).toEqual({
      browser: null,
      os: null,
      isMobile: false,
    });
  });
});
