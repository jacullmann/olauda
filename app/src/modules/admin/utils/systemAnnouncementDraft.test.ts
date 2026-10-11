import { describe, expect, it } from 'vitest';
import type { AdminSystemAnnouncement } from '@/modules/admin/types';
import {
  draftFrom,
  toSaveRequest,
  type SystemAnnouncementDraft,
} from './systemAnnouncementDraft';

const now = new Date(2026, 9, 6, 14, 20);

function draft(
  overrides: Partial<SystemAnnouncementDraft> = {},
): SystemAnnouncementDraft {
  return { ...draftFrom(null, now), content: 'Wartung', ...overrides };
}

describe('a new announcement', () => {
  it('publishes right away and never ends unless told otherwise', () => {
    expect(toSaveRequest(draft(), now)).toEqual({
      ok: true,
      request: { content: 'Wartung', important: false },
    });
  });

  it('proposes the next full hour and a week later', () => {
    const fresh = draftFrom(null, now);
    expect(fresh).toMatchObject({
      scheduled: false,
      startDate: '2026-10-06',
      startTime: '15:00',
      expires: false,
      endDate: '2026-10-13',
      endTime: '15:00',
    });
  });

  it('sends the trimmed text', () => {
    const result = toSaveRequest(draft({ content: '  Wartung \n' }), now);
    expect(result.ok && result.request.content).toBe('Wartung');
  });
});

describe('validation', () => {
  it('rejects blank text', () => {
    expect(toSaveRequest(draft({ content: ' \n ' }), now)).toEqual({
      ok: false,
      field: 'content',
      error: 'text_missing',
    });
  });

  it('counts characters, not UTF-16 units', () => {
    expect(toSaveRequest(draft({ content: '😀'.repeat(160) }), now).ok).toBe(
      true,
    );
    expect(toSaveRequest(draft({ content: 'a'.repeat(161) }), now)).toEqual({
      ok: false,
      field: 'content',
      error: 'text_too_long',
    });
  });

  it('needs a start in the future when scheduled', () => {
    const past = draft({ scheduled: true, startTime: '14:00' });
    expect(toSaveRequest(past, now)).toEqual({
      ok: false,
      field: 'start',
      error: 'start_in_past',
    });
  });

  it('needs both date and time', () => {
    expect(
      toSaveRequest(draft({ scheduled: true, startDate: '' }), now),
    ).toEqual({ ok: false, field: 'start', error: 'date_missing' });
    expect(toSaveRequest(draft({ expires: true, endTime: '' }), now)).toEqual({
      ok: false,
      field: 'end',
      error: 'date_missing',
    });
  });

  it('needs the end after the start', () => {
    const endsAtStart = draft({
      scheduled: true,
      expires: true,
      endDate: '2026-10-06',
      endTime: '15:00',
    });
    expect(toSaveRequest(endsAtStart, now)).toEqual({
      ok: false,
      field: 'end',
      error: 'end_before_start',
    });
  });
});

describe('a schedule', () => {
  it('is sent as instants', () => {
    const result = toSaveRequest(
      draft({ scheduled: true, expires: true }),
      now,
    );
    expect(result).toEqual({
      ok: true,
      request: {
        content: 'Wartung',
        important: false,
        startsAt: new Date(2026, 9, 6, 15).toISOString(),
        endsAt: new Date(2026, 9, 13, 15).toISOString(),
      },
    });
  });

  it('round-trips through an existing announcement', () => {
    const existing: AdminSystemAnnouncement = {
      id: 'a',
      content: 'Wartung',
      important: true,
      status: 'scheduled',
      startsAt: new Date(2026, 9, 10, 8, 30).toISOString(),
      endsAt: new Date(2026, 9, 10, 18).toISOString(),
      authorEmail: null,
      readCount: 0,
    };
    const result = toSaveRequest(draftFrom(existing, now), now);
    expect(result).toEqual({
      ok: true,
      request: {
        content: 'Wartung',
        important: true,
        startsAt: existing.startsAt,
        endsAt: existing.endsAt,
      },
    });
  });
});
