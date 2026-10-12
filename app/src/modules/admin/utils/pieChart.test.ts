import { describe, expect, it } from 'vitest';
import { pieArcs } from './pieChart';

describe('pieArcs', () => {
  it('places each slice right after the one before', () => {
    expect(pieArcs([1, 3, 0, 4])).toEqual([
      { fraction: 0.125, start: 0 },
      { fraction: 0.375, start: 0.125 },
      { fraction: 0, start: 0.5 },
      { fraction: 0.5, start: 0.5 },
    ]);
  });

  it('leaves every slice empty when there is nothing to divide', () => {
    expect(pieArcs([0, 0])).toEqual([
      { fraction: 0, start: 0 },
      { fraction: 0, start: 0 },
    ]);
  });

  it('counts negative values as none', () => {
    expect(pieArcs([-2, 2])).toEqual([
      { fraction: 0, start: 0 },
      { fraction: 1, start: 0 },
    ]);
  });
});
