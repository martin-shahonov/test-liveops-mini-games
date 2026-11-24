import { measureBitmapText } from '../../../../shared/ported/runtime/text/metrics';
import type { BitmapFont } from '../../../../shared/ported/runtime/text/metrics';
import { sectorCentre } from '../../../../shared/ported/engine';
import type { WheelSector } from '../../../../shared/ported/engine';
import { amountRoom } from './discGeometry';
import type { DiscParts } from './discGeometry';
import { formatWedgeAmount } from './formatWedgeAmount';
import type { WheelSkin } from '../../skin/types';

export type PlannedLabel = {
  id: number;
  text: string;
  font: BitmapFont;
  /** Line height in points. */
  size: number;
  /** In from the rim box's edge to the end of the text. */
  inset: number;
  /** The wedge's centre in the wheel's own frame, radians. */
  angle: number;
};

/** Each sector's amount, sized and placed for its wedge in the rim's box. */
export function planLabels(
  sectors: readonly WheelSector[],
  skin: WheelSkin,
  parts: DiscParts,
): PlannedLabel[] {
  const { rimSize, faceSize } = parts;
  if (rimSize <= 0 || faceSize <= 0) return [];

  // Sized per sheet pixel, not per point: the gold sheet's line height is 150
  // and the black's 145, so one point size draws the black glyphs 3.4 % large.
  const glyphScale = faceSize * skin.labels.atlasScale;
  const { radius, room } = amountRoom(parts);

  return sectors.map((sector, index) => {
    const text = formatWedgeAmount(sector.winAmount);
    // Dark glyphs on the light wedges, gold on the dark ones.
    const font = skin.lights[index % skin.lights.length]
      ? skin.labels.fonts.onLight
      : skin.labels.fonts.onDark;
    const fontSize = glyphScale * font.lineHeight;
    const natural = measureBitmapText(text, font, fontSize);
    const size = natural > room ? fontSize * (room / natural) : fontSize;
    const width = Math.min(natural, room);

    // WheelLabel right-aligns its text `inset` in from the rim box's edge, so
    // centring on the label radius means measuring to the far side of the text.
    const inset = rimSize / 2 - (radius + width / 2);

    return {
      id: sector.id,
      text,
      font,
      size,
      inset,
      angle: sectorCentre(index, sectors.length),
    };
  });
}
