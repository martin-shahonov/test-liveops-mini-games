/**
 * The six symbols a card's cells and winning box can show, by the id a
 * card names them with: the files in a skin's `symbols/` folder, her six
 * on the generic card. A card naming any other id has no art for that
 * cell, which the screen reports as an invalid card rather than drawing
 * nothing.
 */
export const SYMBOL_IDS = [
  'coin',
  'crown',
  'heart',
  'clover',
  'star',
  'diamond',
] as const;

export type ScratcherSymbolId = (typeof SYMBOL_IDS)[number];

export const isSymbolId = (id: string): id is ScratcherSymbolId =>
  (SYMBOL_IDS as readonly string[]).includes(id);
