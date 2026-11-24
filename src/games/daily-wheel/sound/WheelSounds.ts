import { gsap, sound, type IMediaInstance } from '@betty-mini-games/test-liveops-sdk'

import { Voice } from '../../../shared/sound/Voice'

import type { SoundSpec, WheelSkin } from '../skin/types'
import type { WinArtTier } from '../../../shared/ported/win/types'
import { SPIN_TIMING } from '../../../shared/ported/engine'
import {
    MOTION,
    SPIN_LOOP_FADE_SECONDS,
    ambienceMove,
    believableSpeed,
    boundariesPassed,
    createThrowCue,
    shimmerVolume,
    speedShare,
    spinLoopRate,
    spinLoopVolume,
    tickRate,
    tickVolume,
    turnedBy,
    wedgeBoundary,
    type MotionKind,
} from '../ported/wheel/soundCues'

type SoundKey = 'ambience' | 'shimmer' | 'tap' | 'launch' | 'spinLoop' | 'tick' | 'win' | 'coinBurst'

/** The ambience fades in over this as the wheel shows. */
const AMBIENCE_IN_SECONDS = 0.5
/** The wheel has stood still this long: the spin air fades. */
const REST_AFTER_MS = 250

/**
 * The wheel's sounds on the web, as MiniGames plays them there (`docs/sounds.md`,
 * `useWheelSounds.ts`), on `@pixi/sound`'s Web Audio: the ambience, the title's glints,
 * the press and the throw, the spin air and a tick per wedge following the wheel's
 * speed, the win by its tier and the coin shower's burst and baked coin bed.
 *
 * Every file carries its level in the mix, so each plays at volume 1 unless a cue moves
 * it. A file that fails to load stays silent; the rest play.
 */
export class WheelSounds {
    protected _voices: Record<SoundKey, Voice>
    protected _beds: Partial<Record<WinArtTier, Voice>> = {}
    protected _ambience: IMediaInstance | null = null
    protected _ambienceLevel = { value: 0 }
    protected _air: IMediaInstance | null = null
    protected _airFade?: gsap.core.Tween
    protected _throw = createThrowCue()
    protected _shimmers = 0
    protected _last?: { rotation: number; at: number; boundary: number }
    protected _lastHandTick = -Infinity
    protected _restTimer?: ReturnType<typeof setTimeout>
    protected _destroyed = false

    constructor(
        skin: WheelSkin,
        protected _sectorCount: () => number,
    ) {
        const specs = (skin.sounds ?? {}) as Record<string, SoundSpec>
        const onError = (url: string, error: unknown) => console.warn('[daily-wheel] a sound did not load', url, error)
        const keys: SoundKey[] = ['ambience', 'shimmer', 'tap', 'launch', 'spinLoop', 'tick', 'win', 'coinBurst']
        this._voices = Object.fromEntries(
            keys.map((key) => [key, new Voice(specs[key] ?? { files: [], seconds: 0 }, onError)]),
        ) as Record<SoundKey, Voice>
        // Only the landed tier's coin bed is ever needed: each loads as a claim names it (`prepareWin`).
        this._bedSpecs = (specs.coinBed ?? {}) as Partial<Record<WinArtTier, SoundSpec>>
    }

    protected _bedSpecs: Partial<Record<WinArtTier, SoundSpec>>

    get muted(): boolean {
        return sound.context.muted
    }

    /** Mutes or unmutes everything (the top row's sound button). */
    toggleMuted(): boolean {
        return sound.toggleMuteAll()
    }

    /** The wheel shows: the ambience loops, fading in over 0.5 s. It waits for the first touch where the browser asks for one. */
    open(): void {
        if (this._ambience) return
        this.startAmbience()
    }

    protected startAmbience(): void {
        if (this._destroyed) return
        const ambience = this._voices.ambience.play({ volume: 0, loop: true })
        if (!ambience) {
            // Not loaded yet: tried again shortly.
            setTimeout(() => this.startAmbience(), 200)
            return
        }
        this._ambience = ambience
        this._ambienceLevel.value = 0
        this.moveAmbience(1, AMBIENCE_IN_SECONDS)
    }

    protected moveAmbience(volume: number, seconds: number): void {
        gsap.to(this._ambienceLevel, {
            value: volume,
            duration: seconds,
            ease: 'none',
            overwrite: true,
            onUpdate: () => {
                if (this._ambience) this._ambience.volume = this._ambienceLevel.value
            },
        })
    }

    /** The title's glow has started a round while the wheel waits: a glint, quieter each time. */
    shimmer(): void {
        this._voices.shimmer.play({ volume: shimmerVolume(this._shimmers) })
        this._shimmers += 1
    }

    /** Spin is pressed. A flick makes no press, so it has none. */
    tap(): void {
        this._voices.tap.play()
    }

    /** A spin has started: the throw sounds on its first forward reading, the glints count again after it. */
    spinStarted(start: 'instant' | 'flick' | 'windUp'): void {
        this._shimmers = 0
        this._throw.spinStarted(start)
    }

    /**
     * The wheel turned to `rotation` this frame, moved by a spin or a hand (`MOTION`):
     * its speed throws, carries the spin air and levels a tick for each frame a wedge
     * boundary passes the pointer.
     */
    motion(rotation: number, kind: MotionKind, now = performance.now()): void {
        const count = this._sectorCount()
        const boundary = wedgeBoundary(rotation, count)
        const last = this._last
        this._last = { rotation, at: now, boundary }
        this.watchRest()
        if (!last || now <= last.at) return
        const velocity = turnedBy(last.rotation, rotation) / ((now - last.at) / 1000)
        const believed = believableSpeed(velocity)
        const share = speedShare(velocity)
        if (kind === MOTION.hand) {
            this._throw.rest()
            this.airOff()
        } else if (believed) {
            if (this._throw.read(velocity)) this._voices.launch.play()
            this.air(share)
        }
        if (boundariesPassed(last.boundary, boundary, count) === 0) return
        // A finger can turn the wheel faster than any spin: its ticks are held to the gap at the top speed.
        if (kind === MOTION.hand) {
            if (now - this._lastHandTick < SPIN_TIMING.cruiseMs / Math.max(1, count)) return
            this._lastHandTick = now
        }
        const tickShare = believed ? share : 1
        this._voices.tick.play({ volume: tickVolume(tickShare, Math.random), speed: tickRate(tickShare, Math.random) })
    }

    /** The spin air at `share` of the top speed, started if it is not playing. */
    protected air(share: number): void {
        if (!this._air) {
            this._air = this._voices.spinLoop.play({ volume: 0, loop: true })
            if (!this._air) return
        }
        this._airFade?.kill()
        this._airFade = undefined
        this._air.volume = spinLoopVolume(share)
        this._air.speed = spinLoopRate(share)
    }

    protected airOff(): void {
        const air = this._air
        if (!air || this._airFade) return
        const level = { value: air.volume }
        this._airFade = gsap.to(level, {
            value: 0,
            duration: SPIN_LOOP_FADE_SECONDS,
            ease: 'none',
            onUpdate: () => (air.volume = level.value),
            onComplete: () => {
                air.stop()
                if (this._air === air) this._air = null
                this._airFade = undefined
            },
        })
    }

    /** No reading for 250 ms: the wheel stands still, and the air fades. */
    protected watchRest(): void {
        clearTimeout(this._restTimer)
        this._restTimer = setTimeout(() => {
            this._throw.rest()
            this.airOff()
            this._last = undefined
        }, REST_AFTER_MS)
    }

    /** The claim has named the tier coming: its coin bed loads while the wheel slows onto it. */
    prepareWin(tier: WinArtTier): void {
        const spec = this._bedSpecs[tier]
        if (!spec || this._beds[tier]) return
        this._beds[tier] = new Voice(spec, (url, error) => console.warn('[daily-wheel] a coin bed did not load', url, error))
    }

    /** The landing: the win's tier sounds as its glow starts, and the ambience makes room. */
    landed(tier: WinArtTier): void {
        this._voices.win.play({ index: tier === 'nice' ? 0 : tier === 'mega' ? 1 : 2 })
        const { volume, seconds } = ambienceMove(true)
        this.moveAmbience(volume, seconds)
    }

    /** The coin shower's first coins: its burst, and its baked bed. */
    showerStarted(tier: WinArtTier): void {
        this._voices.coinBurst.play()
        this._beds[tier]?.play()
    }

    /** The coins have fallen: the ambience comes back. */
    showerEnded(): void {
        const { volume, seconds } = ambienceMove(false)
        this.moveAmbience(volume, seconds)
    }

    /** Its game has gone: every sound it started stops (the loops, a coin bed), and its files are freed. */
    destroy(): void {
        if (this._destroyed) return
        this._destroyed = true
        clearTimeout(this._restTimer)
        gsap.killTweensOf(this._ambienceLevel)
        this._airFade?.kill()
        this._ambience?.stop()
        this._air?.stop()
        this._ambience = null
        this._air = null
        Object.values(this._voices).forEach((voice) => voice.destroy())
        Object.values(this._beds).forEach((voice) => voice?.destroy())
    }
}
