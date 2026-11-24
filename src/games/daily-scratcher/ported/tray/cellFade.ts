import type { CellBox } from './coverage';

/**
 * How far a revealed cell's fade reaches past its box, board points: half
 * the smallest gap between neighbouring cells, side by side or one above
 * the other, so two revealed neighbours' fades meet in the gap between
 * them and no thread of coating stays there. On the designer's grid that
 * is half her 4.012 point gap. A cell with no neighbour, alone in its
 * tray, fades as its own box; cells that touch or overlap, the same.
 */
export function cellFadeGrow(cells: readonly CellBox[]): number {
  let least = Infinity;
  for (let i = 0; i < cells.length; i++) {
    const a = cells[i]!;
    for (let j = i + 1; j < cells.length; j++) {
      const b = cells[j]!;
      // How far apart along each axis: below 0, their spans overlap there.
      const across = Math.max(
        b.left - (a.left + a.width),
        a.left - (b.left + b.width),
      );
      const down = Math.max(
        b.top - (a.top + a.height),
        a.top - (b.top + b.height),
      );
      // Apart along both: corner to corner, not neighbours.
      if (across >= 0 && down >= 0) continue;
      least = Math.min(least, Math.max(0, across, down));
    }
  }
  return Number.isFinite(least) ? least / 2 : 0;
}
