// Tutor persona shown on screen. The photo is cropped into a circle around `focus`.
import type { ImageSourcePropType } from 'react-native';

export type AvatarPhoto = {
  source: ImageSourcePropType;
  /** Pixel size of the image file. */
  width: number;
  height: number;
  /** Pixel point (in the image file) to centre in the circle, e.g. the middle of the face. */
  focus: { x: number; y: number };
  /** Extra zoom on top of "cover" (1 = just fills the circle). */
  zoom: number;
};

export const TUTOR_NAME = 'Miss Rina';
export const TUTOR_INITIAL = 'R';

export const TUTOR_PHOTO: AvatarPhoto = {
  source: require('../../assets/images/mis-rina.png') as ImageSourcePropType,
  width: 613,
  height: 407,
  focus: { x: 300, y: 165 },
  zoom: 1.25,
};
