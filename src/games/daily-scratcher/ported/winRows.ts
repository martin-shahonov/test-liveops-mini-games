/**
 * Where the tokens row sits under the coins row: its line centre this
 * many line boxes below the coins' line centre, so the two rows read as a
 * list with a little air between them.
 */
export const TOKENS_ROW_BELOW = 1.1;

/** The tokens row's line centre, in board points, under the coins row centred on `coins`. */
export function tokensRowCentre(
  coins: readonly [number, number],
  lineHeight: number,
): readonly [number, number] {
  return [coins[0], coins[1] + lineHeight * TOKENS_ROW_BELOW];
}
