// MiniGames' tray barrel, less its React parts (the tray is drawn by the Pixi view).
/**
 * The scratch tray: the canvas over a tray of cells that the finger
 * scratches, the hand canvas that draws the coin and the flakes it scrapes
 * off over both trays, and the numbers the screen times its sounds and
 * ticks by.
 */
export { cellFadeGrow } from './cellFade';
export { trayCanvasBox } from './canvasBox';
export { COATING_UPSCALE, pickCoating, pickCoatingCopy } from './coatingCopy';
export type { CoatingCopyOf } from './coatingCopy';
export {
  COIN_MOTION,
  COIN_POSE,
  COIN_SHADOW,
  coinArtOf,
  coinOpenOf,
} from './coinMotion';
export type {
  CoinArt,
  CoinDirection,
  CoinFrame,
  CoinMode,
  CoinOpen,
  CoinPlan,
} from './coinMotion';
export type { CellBox, CellZones, ReadingZone } from './coverage';
export type { RoundedBox, ScratchField } from './field';
export { BRUSH_RADIUS, BRUSH_WIDTH } from './brush';
export { FINGER_BRUSH } from './fingerBrush';
export type { FingerBrush, FingerPreset } from './fingerBrush';
export { FLAKES } from './flakes';
export type { FlakeDevice, FlakePlan, FlakeTuning } from './flakes';
export { flakePlanOf } from './flakeAtlas';
export { deviceClass } from './tuning';
export { REVEAL } from './revealShader';
export { QUICK_PATH } from './quickPath';
export { alongDiagonal, diagonalOf } from './diagonal';
export type { Diagonal } from './diagonal';
export {
  QUICK_SWEEP,
  sweepEaseInverse,
  sweepOrder,
  sweepProgress,
  thinTicks,
} from './quickSweep';
export type { SweepStep } from './quickSweep';
export {
  MOVING_SPEED,
  SCRATCH_TICK,
  SPEED_REPORT_MS,
  TRAY_TIMING,
} from './trayMotion';
export { ANDROID_EDGE_BAND, STROKE_MARGIN, strokeBoxOf } from './stroke';
export type { TrayLane } from './stroke';
