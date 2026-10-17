import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/vue-query';
import { eventLogQuery, serverMetricsQuery } from './adminQueries';

const { GET } = vi.hoisted(() => ({ GET: vi.fn() }));

vi.mock('@/api/client', () => ({
  default: { GET },
  unwrap: (pending: Promise<unknown>) => pending,
}));

let client: QueryClient;

beforeEach(() => {
  GET.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe('the server metrics', () => {
  it('keeps every sample as a timestamp and a value, gaps included', async () => {
    GET.mockResolvedValue({
      start: 0,
      end: 120,
      cpuCores: 2,
      cpu: [
        [0, 12.5],
        [60, null],
      ],
      networkIn: [[0, 1024]],
      networkOut: [],
    });

    const metrics = await client.fetchQuery(serverMetricsQuery('1h'));

    expect(GET).toHaveBeenCalledWith(
      '/admin/server-metrics',
      expect.objectContaining({ params: { query: { range: '1h' } } }),
    );
    expect(metrics.cpu).toEqual([
      [0, 12.5],
      [60, null],
    ]);
    expect(metrics.networkIn).toEqual([[0, 1024]]);
  });
});

describe('the event log', () => {
  it('asks for each next page with the cursor of the one before', async () => {
    GET.mockResolvedValueOnce({ items: [], nextCursor: 'page-2', total: 3 });
    GET.mockResolvedValueOnce({ items: [], nextCursor: null });

    const log = await client.fetchInfiniteQuery({
      ...eventLogQuery({ order: 'desc' }),
      pages: 3,
    });

    expect(GET).toHaveBeenCalledTimes(2);
    expect(GET.mock.calls[0]?.[1]).toMatchObject({
      params: { query: { order: 'desc', cursor: undefined } },
    });
    expect(GET.mock.calls[1]?.[1]).toMatchObject({
      params: { query: { order: 'desc', cursor: 'page-2' } },
    });
    expect(log.pages).toHaveLength(2);
  });
});
