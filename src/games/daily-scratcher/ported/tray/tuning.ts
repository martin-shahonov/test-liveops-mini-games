import { COIN_MOTION, COIN_SHADOW } from './coinMotion';
import { FINGER_BRUSH } from './fingerBrush';
import { FLAKES } from './flakes';
import type { FlakeDevice } from './flakes';
import type { CoinMotion, CoinShadow } from './coinMotion';
import type { FingerBrush } from './fingerBrush';
import type { FlakeTuning } from './flakes';

/** What the tray reads its feel from (MiniGames' native `tuning.ts`). */
export type Tune = {
  coin: CoinMotion;
  shadow: CoinShadow;
  flakes: FlakeTuning;
  brush: FingerBrush;
};

/**
 * The web's UI thread is its JS thread, and its shared values hold what they
 * are given, so the tray reads the exported objects themselves: a value set
 * from outside, as the studio sets them, shows at the next frame that reads
 * it, with no new card.
 */
export function currentTune(): Tune {
  return {
    coin: COIN_MOTION,
    shadow: COIN_SHADOW,
    flakes: FLAKES,
    brush: FINGER_BRUSH,
  };
}

/**
 * Which of `FLAKES.cap.devices` a browser is taken for: the middle class,
 * whose most, 1370, leaves a `pMax` up to it alone.
 */
export function deviceClass(): FlakeDevice {
  return 'mid';
}
