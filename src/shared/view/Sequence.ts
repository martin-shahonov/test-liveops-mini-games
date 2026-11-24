import { GameObject, PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { SpriteSheet } from '../types'
import { sheetTextures } from './sheetTexture'
import type { PlacedBox } from '../ported/runtime/layout/fit'

/**
 * MiniGames' `sequenceFrame` (vfx/src/spriteSheet.ts): which clip and frame show
 * `elapsedMs` into clips played one after the other, the last one looping or held.
 */
export function sequenceFrame(
    counts: readonly number[],
    fps: readonly number[],
    elapsedMs: number,
    loop: boolean,
): [number, number] {
    const last = counts.length - 1
    let t = Math.max(0, elapsedMs) / 1000
    for (let i = 0; i < last; i++) {
        const length = counts[i]! / fps[i]!
        if (t < length) {
            return [i, Math.min(counts[i]! - 1, Math.floor(t * fps[i]!))]
        }
        t -= length
    }
    const frame = Math.floor(t * fps[last]!)
    const count = counts[last]!
    return [last, loop ? frame % count : Math.min(count - 1, frame)]
}

export type SequenceOptions = {
    loop?: boolean
    /** Called each time the last clip starts over. */
    onLoop?: () => void
    /** Called once the last frame of a sequence that does not loop has shown. */
    onEnd?: () => void
}

/**
 * MiniGames' `SpriteSequence`: TexturePacker clips played one after the other on the
 * ticker, every frame drawn at the untrimmed canvas size over its `box`, added (`additive`)
 * or laid over (`normal`) as the export says. Paused until `play()`.
 */
export class Sequence extends GameObject {
    protected _sprite = new PIXI.Sprite()
    protected _textures: (PIXI.Texture | null)[][]
    protected _counts: number[]
    protected _fps: number[]
    protected _elapsed = 0
    protected _running = false
    protected _round = 0
    protected _ended = false
    protected _held = false

    constructor(
        protected _clips: readonly SpriteSheet[],
        protected _options: SequenceOptions = {},
    ) {
        super()
        this._textures = _clips.map(sheetTextures)
        this._counts = _clips.map((clip) => clip.count)
        this._fps = _clips.map((clip) => clip.fps)
        this._sprite.blendMode = _clips[0]?.blend === 'additive' ? 'add' : 'normal'
        this._sprite.visible = false
        this.addChild(this._sprite)
    }

    get playing(): boolean {
        return this._running
    }

    /** Lays the clips' canvas over `box` (its size is the export's `sourceWidth` x `sourceHeight`). */
    place(box: PlacedBox): void {
        this.position.set(box.left, box.top)
        const clip = this._clips[0]!
        this.scale.set(box.width / clip.sourceWidth, box.height / clip.sourceHeight)
    }

    /** From the start, or on from `at` milliseconds in. */
    play(at = 0): void {
        this._elapsed = at
        this._round = 0
        this._ended = false
        if (!this._running) {
            this._running = true
            PIXI.Ticker.shared.add(this.tick, this)
        } else if (this._held) {
            PIXI.Ticker.shared.add(this.tick, this)
        }
        this._held = false
        this.draw()
    }

    stop(): void {
        if (this._running) {
            this._running = false
            if (!this._held) PIXI.Ticker.shared.remove(this.tick, this)
        }
        this._held = false
        this._sprite.visible = false
    }

    /** Holds the frame showing (MiniGames' `frozen`): no more frames until `resume()`. */
    hold(): void {
        if (this._running && !this._held) {
            this._held = true
            PIXI.Ticker.shared.remove(this.tick, this)
        }
    }

    resume(): void {
        if (this._running && this._held) {
            this._held = false
            PIXI.Ticker.shared.add(this.tick, this)
        }
    }

    override destroy(): void {
        this.stop()
        super.destroy()
    }

    protected tick(ticker: PIXI.Ticker): void {
        this._elapsed += ticker.deltaMS
        this.draw()
    }

    protected draw(): void {
        const loop = this._options.loop ?? false
        const [clip, frame] = sequenceFrame(this._counts, this._fps, this._elapsed, loop)
        const texture = this._textures[clip]?.[frame] ?? null
        this._sprite.visible = texture !== null
        if (texture) {
            this._sprite.texture = texture
        }

        const last = this._counts.length - 1
        if (clip === last) {
            let before = 0
            for (let i = 0; i < last; i++) before += this._counts[i]! / this._fps[i]!
            const length = this._counts[last]! / this._fps[last]!
            const round = Math.floor((this._elapsed / 1000 - before) / length)
            if (loop && round > this._round) {
                this._round = round
                this._options.onLoop?.()
            }
            if (!loop && !this._ended && frame === this._counts[last]! - 1) {
                this._ended = true
                this._options.onEnd?.()
            }
        }
    }
}
