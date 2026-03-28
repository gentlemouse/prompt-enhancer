import { describe, expect, it } from 'vitest';

import {
  calculateRightOverlayInset,
  calculateVisibleAnchorRect,
  type RectLike,
} from '@content/ui/button';

const createRect = (overrides: Partial<RectLike> = {}): RectLike => ({
  left: 100,
  top: 100,
  right: 500,
  bottom: 220,
  width: 400,
  height: 120,
  ...overrides,
});

describe('calculateRightOverlayInset', () => {
  it('reserves space for a send button in the bottom-right action area', () => {
    const inputRect = createRect();
    const sendButtonRect = createRect({
      left: 452,
      right: 484,
      top: 176,
      bottom: 208,
      width: 32,
      height: 32,
    });

    expect(calculateRightOverlayInset(inputRect, [sendButtonRect])).toBe(54);
  });

  it('ignores controls outside the right-side action area', () => {
    const inputRect = createRect();
    const leftToolbarRect = createRect({
      left: 126,
      right: 158,
      top: 176,
      bottom: 208,
      width: 32,
      height: 32,
    });

    expect(calculateRightOverlayInset(inputRect, [leftToolbarRect])).toBe(0);
  });

  it('caps the reserved width to avoid pushing the button too far left', () => {
    const inputRect = createRect();
    const oversizedOverlayRect = createRect({
      left: 280,
      right: 490,
      top: 120,
      bottom: 216,
      width: 210,
      height: 96,
    });

    expect(calculateRightOverlayInset(inputRect, [oversizedOverlayRect])).toBe(
      180
    );
  });
});

describe('calculateVisibleAnchorRect', () => {
  it('keeps the anchor inside the visible composer area when content is taller than its clipped container', () => {
    const inputRect = createRect({
      top: 100,
      bottom: 760,
      height: 660,
    });
    const clippingRect = createRect({
      left: 90,
      top: 120,
      right: 510,
      bottom: 320,
      width: 420,
      height: 200,
    });

    expect(
      calculateVisibleAnchorRect(inputRect, [clippingRect], 1200, 900)
    ).toEqual({
      left: 100,
      top: 120,
      right: 500,
      bottom: 320,
      width: 400,
      height: 200,
    });
  });

  it('clips the anchor rect to the viewport when the input extends below the fold', () => {
    const inputRect = createRect({
      top: 640,
      bottom: 980,
      height: 340,
    });

    expect(calculateVisibleAnchorRect(inputRect, [], 1280, 720)).toEqual({
      left: 100,
      top: 640,
      right: 500,
      bottom: 720,
      width: 400,
      height: 80,
    });
  });
});
