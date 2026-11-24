import { Model } from '@betty-mini-games/test-liveops-sdk'

import type { WheelSkin } from './skin/types'
import type { SpinLaunch, WheelSector } from '../../shared/ported/engine'
import type { FlickRelease, SpinLanding } from './ported/wheel/spinController'
import type { SpinRun, SpinSession } from './spin/SpinSession'
import type { WheelBackend } from './backend/mockBackend'
import type { WheelSounds } from './sound/WheelSounds'

/** The wheel's state, shared by its state actions. */
export class DailyWheelModel extends Model {
    skin!: WheelSkin
    tierName = ''
    sectors: readonly WheelSector[] = []
    backend!: WheelBackend
    session!: SpinSession
    /** How the next spin leaves rest: the button's press, or a flick's release. */
    start: SpinLaunch = 'instant'
    release?: FlickRelease
    /** The spin under way, and what it came to. */
    run?: SpinRun
    landing?: SpinLanding
    error?: unknown
    /** The spin's number on this screen, counted from 1. */
    spin = 0
    /** A claim failed in a way that may have paid out: no more spins on this screen. */
    locked = false
    muted = false
    sounds!: WheelSounds
    /** Set by a host: the wheel closes after one spin instead of offering Spin again. */
    onClose?: () => void
    /** Set while Spin is offered: takes a flick's release as a spin (true) or not. */
    flick?: (release: FlickRelease) => boolean
}
