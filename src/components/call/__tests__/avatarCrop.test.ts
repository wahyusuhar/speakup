import { TUTOR_PHOTO } from '@/config/tutor';

import { FOCUS_Y_IN_CIRCLE, avatarCrop } from '../avatarCrop';

const covers = (box: number, c: ReturnType<typeof avatarCrop>) =>
  c.left <= 0 && c.top <= 0 && c.left + c.width >= box - 1e-9 && c.top + c.height >= box - 1e-9;

describe('avatarCrop', () => {
  it('covers the circle and centres the focus point when possible', () => {
    const box = 200;
    const c = avatarCrop(box, { width: 600, height: 400 }, { x: 300, y: 200 }, 1.5);
    expect(covers(box, c)).toBe(true);
    const scale = c.width / 600;
    expect(c.left + 300 * scale).toBeCloseTo(box / 2);
    expect(c.top + 200 * scale).toBeCloseTo(box * FOCUS_Y_IN_CIRCLE);
  });

  it('never leaves empty edges when the focus is near a border', () => {
    const box = 100;
    for (const focus of [
      { x: 0, y: 0 },
      { x: 600, y: 400 },
      { x: 10, y: 390 },
    ]) {
      expect(covers(box, avatarCrop(box, { width: 600, height: 400 }, focus, 1))).toBe(true);
    }
  });

  it('treats zoom below 1 as 1 (always cover)', () => {
    const c = avatarCrop(100, { width: 400, height: 400 }, { x: 200, y: 200 }, 0.5);
    expect(c.width).toBe(100);
    expect(covers(100, c)).toBe(true);
  });

  it('frames the tutor photo with the face inside the circle', () => {
    for (const box of [104, 200]) {
      const c = avatarCrop(box, TUTOR_PHOTO, TUTOR_PHOTO.focus, TUTOR_PHOTO.zoom);
      expect(covers(box, c)).toBe(true);
      const scale = c.width / TUTOR_PHOTO.width;
      // Face centre lands within 10% of the target point.
      expect(Math.abs(c.left + TUTOR_PHOTO.focus.x * scale - box / 2)).toBeLessThan(box * 0.1);
      expect(Math.abs(c.top + TUTOR_PHOTO.focus.y * scale - box * FOCUS_Y_IN_CIRCLE)).toBeLessThan(box * 0.1);
    }
  });
});
