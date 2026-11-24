// The types of MiniGames' `@betty-gaming/minigames-vfx` the ported games read.
export type { SpriteSheet, VfxBundle } from '../types'

/** Where a clip's untrimmed canvas lands in its canvas, in points. */
export type SpriteTile = { x: number; y: number; width: number; height: number }
/** A box in its parent's points. */
export type VfxBox = { left: number; top: number; width: number; height: number }
/** An image a sheet or an effect reads, as the skin names it. */
export type VfxTextureSource = string
