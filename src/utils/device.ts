export const isTouchDevice: boolean =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

/** Coarse "is this a phone/tablet" check, used for quality defaults. */
export const isMobile: boolean =
  isTouchDevice && window.matchMedia('(pointer: coarse)').matches;
