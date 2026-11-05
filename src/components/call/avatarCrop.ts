/** Where the focus point should land inside the circle (0 = top, 1 = bottom). Faces read best a bit above centre. */
export const FOCUS_Y_IN_CIRCLE = 0.45;

export type Crop = { width: number; height: number; left: number; top: number };

/**
 * Size and offset of an image inside a square `box` so that it covers the box (no empty edges),
 * is zoomed by `zoom`, and puts `focus` as close as possible to the centre (x) / FOCUS_Y_IN_CIRCLE (y).
 */
export function avatarCrop(
  box: number,
  image: { width: number; height: number },
  focus: { x: number; y: number },
  zoom = 1,
): Crop {
  const scale = Math.max(box / image.width, box / image.height) * Math.max(1, zoom);
  const width = image.width * scale;
  const height = image.height * scale;
  const clamp = (v: number, min: number) => Math.min(0, Math.max(min, v));
  return {
    width,
    height,
    left: clamp(box / 2 - focus.x * scale, box - width),
    top: clamp(box * FOCUS_Y_IN_CIRCLE - focus.y * scale, box - height),
  };
}
