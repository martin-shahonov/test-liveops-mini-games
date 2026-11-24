import { gsap, Sound, type IMediaInstance } from '@betty-mini-games/test-liveops-sdk'

import type { SoundSpec } from '../ported/runtime'

/** One of the skin's sounds: its files, each a `Sound` once loaded, played in turn or at random. */
export class Voice {
    readonly files: (Sound | null)[]
    protected _next = 0
    protected _last = -1
    protected _destroyed = false

    constructor(
        protected _spec: SoundSpec,
        onError: (url: string, error: unknown) => void,
    ) {
        this.files = _spec.files.map(() => null)
        _spec.files.forEach((url, i) => {
            Sound.from({
                url,
                preload: true,
                loaded: (error, loaded) => {
                    if (error || !loaded) onError(url, error)
                    // Its game went while it loaded: nothing will play it.
                    else if (this._destroyed) loaded.destroy()
                    else this.files[i] = loaded
                },
            })
        })
    }

    /** The next file: in turn, or at random but never the last one's (`order: 'random'`). */
    protected pick(index?: number): Sound | null {
        const count = this.files.length
        if (index !== undefined) return this.files[Math.min(index, count - 1)] ?? null
        let at: number
        if (this._spec.order === 'random' && count > 1) {
            do at = Math.floor(Math.random() * count)
            while (at === this._last)
        } else {
            at = this._next
            this._next = (this._next + 1) % count
        }
        this._last = at
        return this.files[at] ?? null
    }

    /** Plays a file (the `index`th, where given), or nothing while it has not loaded. */
    play(options: { volume?: number; speed?: number; loop?: boolean; index?: number } = {}): IMediaInstance | null {
        if (this._destroyed) return null
        const file = this.pick(options.index)
        if (!file?.isPlayable) return null
        const played = file.play({ volume: options.volume ?? 1, speed: options.speed ?? 1, loop: options.loop ?? false })
        return played instanceof Promise ? null : played
    }

    /**
     * Stops every instance of its files still playing (a loop, a coin bed) and frees them.
     * `@pixi/sound` plays on one Web Audio context for the whole page, which outlives a game.
     */
    destroy(): void {
        this._destroyed = true
        this.files.forEach((file) => file?.destroy())
        this.files.fill(null)
    }
}


/** A playing loop's volume moved to `volume` over `seconds` (MiniGames' `SoundVoice.setVolume` ramp), then `done`. */
export function rampVolume(instance: IMediaInstance, volume: number, seconds: number, done?: () => void): gsap.core.Tween {
    const level = { value: instance.volume }
    return gsap.to(level, {
        value: volume,
        duration: seconds,
        ease: 'none',
        overwrite: true,
        onUpdate: () => (instance.volume = level.value),
        onComplete: done,
    })
}
