import { Model } from '@betty-mini-games/test-liveops-sdk'

import type { ScratcherSkin } from './ported/skins'
import type { ScratcherCard, ScratcherReward } from './ported/rules'
import type { ScratcherBackend } from './backend/mockBackend'
import type { CardPlay } from './play/CardPlay'
import type { ScratcherSounds } from './sound/ScratcherSounds'
import type { ClaimLanding } from './ported/scratchController'

/** The card's state, shared by its state actions. */
export class DailyScratcherModel extends Model {
    skin!: ScratcherSkin
    card!: ScratcherCard
    backend!: ScratcherBackend
    /** The claim, asked for once as the first stroke or Quick Scratch starts. */
    claim?: Promise<ScratcherReward>
    reward?: ScratcherReward
    /** The claim's outcome, reconciled with the card, once both boxes are done. */
    landing?: ClaimLanding
    error?: unknown
    /** The scratch's number on this screen, counted from 1: a card offered again starts another. */
    scratch = 0
    /** A claim failed in a way that may have paid out: the card takes no more scratches. */
    locked = false
    muted = false
    play!: CardPlay
    sounds!: ScratcherSounds
    /** Set by a host: COLLECT closes the game. */
    onClose?: () => void
}
