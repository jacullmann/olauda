import { describe, expect, it } from 'vitest';
import {
  TRICKLE_DURATION,
  TRICKLE_LIMIT,
  trickleKeyframes,
  trickleProgress,
} from './loadingBarProgress';

function keyframeScale(keyframe: Keyframe) {
  return Number(/scaleX\((.+)\)/.exec(String(keyframe.transform))?.[1]);
}

describe('trickleProgress', () => {
  it('starts where the bar set off from', () => {
    expect(trickleProgress(0)).toBe(0);
    expect(trickleProgress(0, 0.4)).toBe(0.4);
  });

  it('keeps moving forwards without reaching the limit', () => {
    let previous = 0;
    for (let elapsed = 100; elapsed <= TRICKLE_DURATION; elapsed += 100) {
      const progress = trickleProgress(elapsed);
      expect(progress).toBeGreaterThan(previous);
      expect(progress).toBeLessThan(TRICKLE_LIMIT);
      previous = progress;
    }
  });

  it('has nearly reached the limit when the trickle ends', () => {
    expect(trickleProgress(TRICKLE_DURATION)).toBeCloseTo(TRICKLE_LIMIT, 3.5);
  });

  it('holds a bar that is already past the limit', () => {
    expect(trickleProgress(5000, 0.97)).toBe(0.97);
  });
});

describe('trickleKeyframes', () => {
  it('spans the whole animation from the starting point', () => {
    const keyframes = trickleKeyframes(0.3);
    expect(keyframes[0]).toEqual({ offset: 0, transform: 'scaleX(0.3)' });
    expect(keyframes.at(-1)?.offset).toBe(1);
  });

  it('follows the curve with rising offsets and progress', () => {
    trickleKeyframes().reduce((previous, keyframe) => {
      const offset = Number(keyframe.offset);
      expect(offset).toBeGreaterThan(Number(previous.offset));
      expect(keyframeScale(keyframe)).toBeCloseTo(
        trickleProgress(offset * TRICKLE_DURATION),
        10,
      );
      return keyframe;
    });
  });
});
