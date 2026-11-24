/**
 * A tier's skin, as `skins/<tier>.json` holds it: MiniGames' `WheelSkin`
 * (games/wheel/src/skins/types.ts, 0.11.0) resolved for that tier with its files
 * served from `test-liveops-assets/daily-wheel/`, written by
 * `scripts/daily-wheel/export-skins.mjs`. Paths start with `@/`, the folder's root.
 *
 * Functions do not survive JSON: `lightAtIndex(i)` is `lights[i]`.
 */
import type { AssetSource, SpriteSheet, WinScreenArt } from '../../../shared/types'
import type { BoardBox, BoardSpec } from '../../../shared/ported/runtime/layout/fit'
import type { BackdropPoster, BackdropVideo } from '../../../shared/ported/runtime/layout/videoSource'
import type { BitmapFont } from '../../../shared/ported/runtime/text/metrics'



export type WheelGlows = {
    rim: { intro: SpriteSheet; idle: SpriteSheet; size: number; centre: readonly [number, number] }
    sector: {
        intro: SpriteSheet
        idle: SpriteSheet
        size: number
        apex: number
        meet?: number
        edges?: readonly [number, number]
    }
    button: { loop: SpriteSheet; line: { width: number; height: number } }
    title?: { loop: SpriteSheet; box: BoardBox; split: number; word: string }
}

export type WheelAssetName = 'rim' | 'facebase' | 'facesectors' | 'gem' | 'pointer' | 'titletier' | 'titlegame'
export type WheelSlotName = 'uirow' | 'btnspin'

export type VideoRect = { x: number; y: number; w: number; h: number }
export type FloorShine = { box: VideoRect; clips: readonly SpriteSheet[] }
export type FloorCut = {
    frame: readonly [number, number]
    still: { source: AssetSource; rect: VideoRect }
    shines: readonly FloorShine[]
}
export type SkinFloor = { portrait: FloorCut; square: FloorCut }
export type SideTone = readonly (readonly [row: number, colour: string])[]
export type SkinSides = { rows: number; left: SideTone; right: SideTone }

export type FaceBar = { dir: number; off: number; across: readonly [number, number] }
export type SectorSlices = {
    canvas: number
    centre: readonly [number, number]
    dark: { centre: number; half: number }
    bars: { lightCcw: FaceBar; lightCw: FaceBar }
    barReach: readonly [number, number]
}

export type UiButtonSources = Readonly<Record<'frame' | 'faceIdle' | 'faceActive' | 'facePressed' | 'glow', AssetSource>>

export type SoundSpec = {
    files: readonly AssetSource[]
    seconds: number
    loop?: boolean
    silence?: number
    volume?: number
    [key: string]: unknown
}

export type WheelSkin = BoardSpec & {
    id: string
    loyaltyTier: string
    name: string
    elements: Readonly<Record<WheelAssetName | WheelSlotName, BoardBox>>
    sources: Readonly<Record<WheelAssetName, AssetSource>>
    spinColor: string
    backdropVideo?: BackdropVideo
    backdropPoster?: BackdropPoster
    floor?: SkinFloor
    sides?: SkinSides
    glows?: WheelGlows
    rim: { inner: number; outer: number }
    gem: { radius: number; centre: readonly [number, number] }
    labels: { radius: number; atlasScale: number; fonts: { onLight: BitmapFont; onDark: BitmapFont } }
    /** `lightAtIndex(i)` of MiniGames, per sector of the skin's own wheel. */
    lights: readonly boolean[]
    boost: string
    sectors: number
    sectorSlices?: SectorSlices
    winScreen: WheelWinArt
    howToPlay: { steps: { vip: readonly AssetSource[]; plain: readonly AssetSource[] }; stones: readonly AssetSource[] }
    popups: { wifi: AssetSource; alert: AssetSource; hourglass: AssetSource }
    ui: UiButtonSources
    sounds?: Record<string, SoundSpec | unknown>
}


/** The wheel's win screen: the shared art, and the wheel lit up behind it (MiniGames' `WheelWinArt`). */
export type WheelWinArt = WinScreenArt & { glow: { intro: SpriteSheet; idle: SpriteSheet; box: BoardBox } }

export type { AssetSource, SpriteSheet, VfxBundle, TierEffects, LockupWord, LockupLight, WinScreenArt } from '../../../shared/types'
