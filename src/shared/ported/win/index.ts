// The parts of MiniGames' `@betty-gaming/minigames-win` the ported games read.
import type { SoundSpec } from '../runtime'
import type { WinArtTier } from './types'

export type { WinArtTier, TierMotion, LockupElement } from './types'
export type { WinScreenArt, TierEffects, LockupWord, LockupLight } from '../../types'
export * from './winScreen'
export * from './formatAmount'
export * from './lockupClock'
export * from './winBoxes'
export * from './winPlacement'
export * from './coinShowerPlacement'

/** What the win plays, by the moment it marks. */
export type WinSoundKey = 'win' | 'coinBurst' | 'coin'
/** The coin shower baked into one file per tier, with its loud coins in ms from its start. */
export type WinCoinBed = SoundSpec & { loudCoinsMs: readonly number[] }
export type WinCoinBeds = Readonly<Record<WinArtTier, WinCoinBed>>
