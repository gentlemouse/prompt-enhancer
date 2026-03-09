import { describe, expect, it } from 'vitest';

import {
  calculateRightOverlayInset,
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
