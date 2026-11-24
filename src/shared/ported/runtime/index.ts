// The parts of MiniGames' `@betty-gaming/minigames-runtime` the ported games read, as one
// module, so a ported file's import of the package only changes its path.
export * from './layout/fit'
export * from './layout/videoSource'
export * from './layout/topRow'
export * from './shell/frame'
export * from './text/metrics'
export * from './ui/tokens'

/** MiniGames' `SoundVoice`: one play of a sound, levelled as it plays. */
export interface SoundVoice {
    setVolume(volume: number, rampSeconds?: number): void
    setRate(rate: number): void
    stop(fadeSeconds?: number): void
}

/** The playback rates a sound keeps to on every platform (MiniGames: AVAudioPlayer's range). */
export const MIN_RATE = 0.5
export const MAX_RATE = 2

/** MiniGames' haptics: a named feel, or several at their own times. */
export type HapticFeel = 'selection' | 'light' | 'medium' | 'heavy' | 'soft' | 'rigid' | 'success' | 'warning' | 'error'
export type HapticStep = { feel: HapticFeel; at?: number }
export type HapticPattern = HapticFeel | readonly HapticStep[]

/** Whether the device takes touches (MiniGames' `isTouchDevice`). */
export function isTouchDevice(): boolean {
    return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
}

export type { AssetSource } from '../../types'
import type { AssetSource } from '../../types'

/** One sound of a game's set: its files, its length and how it plays (MiniGames' `SoundSpec`). */
export type SoundSpec = {
    files: readonly AssetSource[]
    seconds: number
    silence?: number
    loop?: boolean
    stretches?: boolean
    pausesOnStop?: boolean
    order?: 'cycle' | 'random'
    peakRate?: number
    volume?: number
}
export type SoundSet<Key extends string> = Readonly<Record<Key, SoundSpec>>

/** The universal button's five sprites (MiniGames' `UiButtonSources`). */
export type UiButtonPart = 'frame' | 'faceIdle' | 'faceActive' | 'facePressed' | 'glow'
export type UiButtonSources = Readonly<Record<UiButtonPart, AssetSource>>
