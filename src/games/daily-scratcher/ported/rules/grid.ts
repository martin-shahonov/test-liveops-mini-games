export type Grid = { columns: number; rows: number };

/** Cells to a row when neither the count nor the host says. */
const DEFAULT_COLUMNS = 3;

/**
 * How YOUR SYMBOLS are laid out: 9 cells as 3 x 3 and 12 as 4 x 3, the two
 * layouts the trays are drawn for, whatever `columns` says; any other count
 * takes the host's `columns`, three without one, over as many rows as it
 * fills.
 */
export function gridFor(count: number, columns?: number): Grid {
  const across =
    count === 9
      ? 3
      : count === 12
        ? 4
        : columns !== undefined && Number.isInteger(columns) && columns > 0
          ? columns
          : DEFAULT_COLUMNS;
  return { columns: across, rows: Math.ceil(Math.max(count, 0) / across) };
}

/** The index in row-major order of the cell at `row`, `column`. */
export const cellIndex = (
  row: number,
  column: number,
  columns: number,
): number => row * columns + column;

/** Where the cell at `index` sits, in rows and columns from the top left. */
export const cellPosition = (
  index: number,
  columns: number,
): { row: number; column: number } => ({
  row: Math.floor(index / columns),
  column: index % columns,
});
