/**
 * The art types both games' skins share, as their exporters write them: MiniGames'
 * vfx `SpriteSheet` and the win package's `WinScreenArt`, resolved to plain JSON.
 */
import type { BoardBox } from './ported/runtime/layout/fit'
import type { BitmapFont } from './ported/runtime/text/metrics'
import type { TierMotion, WinArtTier } from './ported/win/types'

export type AssetSource = string

/** A TexturePacker sequence flattened: per frame `[x, y, w, h, rotated, trimX, trimY]` (see `sheetTexture.ts`). */
export type SpriteSheet = {
    images: readonly AssetSource[]
    frames: readonly number[]
    pages: readonly number[]
    empty: readonly boolean[]
    count: number
    sourceWidth: number
    sourceHeight: number
    fps: number
    blend: 'normal' | 'add' | 'screen' | string
}

/** A nixie-fx export: its effects by id, and its textures' files by the path the effects name them by. */
export type VfxBundle = { effects: Readonly<Record<string, unknown>>; textures: Readonly<Record<string, AssetSource>> }

/** One effect played at each tier's length, by the id each tier plays (already retimed by the exporter). */
export type TierEffects = { bundle: VfxBundle; ids: Readonly<Record<WinArtTier, string>> }

export type LockupWord = { source: AssetSource; box: BoardBox }
export type LockupLight = { clip: SpriteSheet; box: BoardBox }

/** MiniGames' `WinScreenArt`, and the wheel's glow behind it (`WinScreenArt`). */
export type WinScreenArt = {
    dim: { color: string; opacity: number }
    sparks: VfxBundle
    tiers: Readonly<
        Record<
            WinArtTier,
            {
                lockup: {
                    words: { tier: LockupWord; win: LockupWord }
                    lights: { glows: { tier: LockupLight; win: LockupLight }; passes: readonly LockupLight[] }
                    motion: TierMotion
                }
                counter: readonly [number, number]
                particles: readonly [number, number]
                outAt: number
                goneAt: number
            }
        >
    >
    coin: { source: AssetSource; size: number; gap: number; drop: number; flip?: { clip: SpriteSheet; size: number } }
    counter: { font: BitmapFont; scale: number }
    shower: TierEffects
    particles: TierEffects
}
