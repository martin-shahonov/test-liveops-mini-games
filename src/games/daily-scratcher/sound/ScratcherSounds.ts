import { gsap, sound, type IMediaInstance } from '@betty-mini-games/test-liveops-sdk'

import { Voice, rampVolume } from '../../../shared/sound/Voice'
import type { SoundSpec } from '../../../shared/ported/runtime'
import type { WinArtTier } from '../../../shared/ported/win/types'
import type { Tray } from '../ported/screenState'
import {
    MATCH_VOLUME,
    NOWIN_VOLUME,
    QUICK_VOLUME,
    REVEAL_TICK_GAP_MS,
    SCRATCH_ATTACK_SECONDS,
    SCRATCH_LIFT_SECONDS,
    SCRATCH_RELEASE_SECONDS,
    SCRATCH_REST_MS,
    ambienceMove,
    revealRate,
    revealVolume,
    scratchMove,
    scratchRate,
} from '../ported/soundCues'
import type { PlayCues } from '../play/CardPlay'
import type { ScratcherSkin } from '../ported/skins'

type SoundKey = 'ambience' | 'tap' | 'scratch' | 'reveal' | 'match' | 'quick' | 'nowin' | 'win' | 'coinBurst'

/** The ambience fades in over this as the card shows. */
const AMBIENCE_IN_SECONDS = 0.5

/** MiniGames' `createHapticGate`: true at most once every `gapMs`. */
function gate(gapMs: number): (now: number) => boolean {
    let last = -Infinity
    return (now) => {
        if (now - last < gapMs) return false
        last = now
        return true
    }
}

/**
 * The scratcher's sounds on the web, as MiniGames plays them there (`useScratcherSounds`,
 * `soundCues.ts`), on `@pixi/sound`: the ambience, the press, Quick Scratch's whoosh, the
 * scratch loop following the fastest finger, a tick per cell revealed, a chime per match,
 * the no-win sting, and the win by its tier with the coin shower's burst and baked bed.
 */
export class ScratcherSounds implements PlayCues {
    protected _voices: Record<SoundKey, Voice>
    protected _beds: Partial<Record<WinArtTier, Voice>> = {}
    protected _bedSpecs: Partial<Record<WinArtTier, SoundSpec>>
    protected _ambience: IMediaInstance | null = null
    protected _scratch: IMediaInstance | null = null
    protected _scratchLevel = 0
    protected _speeds: Record<Tray, number> = { winning: 0, yours: 0 }
    protected _fingers: Record<Tray, boolean> = { winning: false, yours: false }
    protected _restTimer?: ReturnType<typeof setTimeout>
    protected _destroyed = false
    protected _tickGate = gate(REVEAL_TICK_GAP_MS)
    protected _chimeGate = gate(REVEAL_TICK_GAP_MS)

    constructor(skin: ScratcherSkin) {
        const specs = (skin.sounds ?? {}) as unknown as Record<string, SoundSpec>
        const onError = (url: string, error: unknown) => console.warn('[daily-scratcher] a sound did not load', url, error)
        const keys: SoundKey[] = ['ambience', 'tap', 'scratch', 'reveal', 'match', 'quick', 'nowin', 'win', 'coinBurst']
        this._voices = Object.fromEntries(
            keys.map((key) => [key, new Voice(specs[key] ?? { files: [], seconds: 0 }, onError)]),
        ) as Record<SoundKey, Voice>
        this._bedSpecs = (specs.coinBed ?? {}) as unknown as Partial<Record<WinArtTier, SoundSpec>>
    }

    toggleMuted(): boolean {
        return sound.toggleMuteAll()
    }

    /** The card shows: the ambience loops, fading in. */
    open(): void {
        if (this._ambience || this._destroyed) return
        const ambience = this._voices.ambience.play({ volume: 0, loop: true })
        if (!ambience) {
            setTimeout(() => this.open(), 200)
            return
        }
        this._ambience = ambience
        rampVolume(ambience, 1, AMBIENCE_IN_SECONDS)
    }

    // The play's cues (`PlayCues`).
    tap(): void {
        this._voices.tap.play()
    }
    quick(): void {
        this._voices.quick.play({ volume: QUICK_VOLUME })
    }
    nowin(): void {
        this._voices.nowin.play({ volume: NOWIN_VOLUME })
    }
    sweepTick(): void {
        this._voices.reveal.play({ volume: revealVolume(Math.random), speed: revealRate(Math.random) })
    }
    reveal(): void {
        if (this._tickGate(performance.now())) this.sweepTick()
    }
    match(): void {
        if (this._chimeGate(performance.now())) this._voices.match.play({ volume: MATCH_VOLUME })
    }
    burst(): void {}
    lift(): void {
        this._speeds = { winning: 0, yours: 0 }
        this._fingers = { winning: false, yours: false }
        this.scratchLift()
    }
    boxDone(tray: Tray): void {
        this._fingers[tray] = false
        this._speeds[tray] = 0
    }

    /** A finger went down on `tray`. */
    touched(tray: Tray): void {
        this._fingers[tray] = true
    }

    /** A finger lifted off `tray`: the loop goes once no finger is left. */
    released(tray: Tray): void {
        this._fingers[tray] = false
        this._speeds[tray] = 0
        if (this._fingers.winning || this._fingers.yours) return
        clearTimeout(this._restTimer)
        this._restTimer = undefined
        this.scratchLift(SCRATCH_LIFT_SECONDS)
    }

    /**
     * The finger's speed on `tray`, as the tray reports it: the scratch loop follows the
     * fastest finger, its level and its bend, and lifts once still for `SCRATCH_REST_MS`.
     */
    speed(tray: Tray, pointsPerSecond: number): void {
        this._speeds[tray] = pointsPerSecond
        const fastest = Math.max(this._speeds.winning, this._speeds.yours)
        const move = scratchMove(fastest, this._scratchLevel)
        if (!this._scratch) {
            if (move.volume > 0) {
                this._scratch = this._voices.scratch.play({ volume: 0, loop: true, speed: scratchRate(fastest) })
                if (this._scratch) rampVolume(this._scratch, move.volume, SCRATCH_ATTACK_SECONDS)
                this._scratchLevel = this._scratch ? move.volume : 0
            }
        } else {
            rampVolume(this._scratch, move.volume, move.seconds)
            if (fastest > 0) this._scratch.speed = scratchRate(fastest)
            this._scratchLevel = move.volume
        }
        if (fastest > 0) {
            clearTimeout(this._restTimer)
            this._restTimer = undefined
        } else if (!this._restTimer) {
            this._restTimer = setTimeout(() => {
                this._restTimer = undefined
                this.scratchLift()
            }, SCRATCH_REST_MS)
        }
    }

    protected scratchLift(seconds = SCRATCH_RELEASE_SECONDS): void {
        const voice = this._scratch
        this._scratch = null
        this._scratchLevel = 0
        if (voice) rampVolume(voice, 0, seconds, () => voice.stop())
    }

    /** A win of `tier` is coming: its coin bed loads. */
    prepareWin(tier: WinArtTier): void {
        const spec = this._bedSpecs[tier]
        if (!spec || this._beds[tier]) return
        this._beds[tier] = new Voice(spec, (url, error) => console.warn('[daily-scratcher] a coin bed did not load', url, error))
    }

    /** The win screen starts: its tier's sound, and the ambience makes room. */
    win(tier: WinArtTier): void {
        this._voices.win.play({ index: tier === 'nice' ? 0 : tier === 'mega' ? 1 : 2 })
        const { volume, seconds } = ambienceMove(true)
        if (this._ambience) rampVolume(this._ambience, volume, seconds)
    }

    showerStarted(tier: WinArtTier): void {
        this._voices.coinBurst.play()
        this._beds[tier]?.play()
    }

    showerEnded(): void {
        const { volume, seconds } = ambienceMove(false)
        if (this._ambience) rampVolume(this._ambience, volume, seconds)
    }

    /** Its game has gone: every sound it started stops (the loops, a coin bed), and its files are freed. */
    destroy(): void {
        if (this._destroyed) return
        this._destroyed = true
        clearTimeout(this._restTimer)
        gsap.killTweensOf(this)
        this._ambience?.stop()
        this._scratch?.stop()
        this._ambience = null
        this._scratch = null
        Object.values(this._voices).forEach((voice) => voice.destroy())
        Object.values(this._beds).forEach((voice) => voice?.destroy())
    }
}
