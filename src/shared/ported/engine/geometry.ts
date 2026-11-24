import type { WheelSector } from './types';

export const TAU = Math.PI * 2;

/** 12 o'clock, measured clockwise from 3 o'clock, the frame the face is drawn in. */
export const POINTER_ANGLE = (3 * Math.PI) / 2;

export const sectorArc = (count: number): number => TAU / Math.max(count, 1);

/** Centre of sector `index`: half an arc in, so no seam sits under the pointer. */
export const sectorCentre = (index: number, count: number): number =>
  (index + 0.5) * sectorArc(count);

// `normalise` and `spinDistance` also run on a renderer's UI thread, where the
// spin hands over to its settle, so they are marked as worklets. Wherever no
// worklet compiler runs, the directive is a plain string.
export const normalise = (angle: number): number => {
  'worklet';
  const a = angle % TAU;
  // A negative angle within rounding of zero wraps to TAU itself, so reduce again.
  return a < 0 ? (a + TAU) % TAU : a;
};

export const findSectorIndex = (
  sectors: readonly WheelSector[],
  rewardId: number,
): number => sectors.findIndex((s) => s.id === rewardId);

// `jitter` is clamped to a third of the arc: a wheel resting on a wedge boundary
// can show a prize it did not pay.
export const restingRotationFor = (
  index: number,
  count: number,
  jitter = 0,
): number => {
  const arc = sectorArc(count);
  const bounded = Math.max(-arc / 3, Math.min(arc / 3, jitter));
  return normalise(POINTER_ANGLE - sectorCentre(index, count) + bounded);
};

/**
 * The sector under the pointer with the wheel turned to `rotation`, however
 * many turns it is wound: what `restingRotationFor` puts there, read back.
 */
export const sectorAtRotation = (rotation: number, count: number): number =>
  Math.floor(normalise(POINTER_ANGLE - rotation) / sectorArc(count)) %
  Math.max(count, 1);

/** Whole turns plus the distance to the resting angle, always forward. */
export const spinDistance = (
  from: number,
  to: number,
  fullTurns: number,
): number => {
  'worklet';
  const delta = normalise(to - normalise(from));
  return fullTurns * TAU + delta;
};

export const randomJitter = (arc: number): number =>
  (Math.random() * 2 - 1) * (arc / 3);
