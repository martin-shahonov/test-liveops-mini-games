import { GameObject, gsap, PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { SpriteSheet } from '../types'
import { Sequence, type SequenceOptions } from './Sequence'

/** A rectangle in its parent's points. */
export type Rect = { x: number; y: number; width: number; height: number }

/**
 * Where a glow draws, as MiniGames' `SpriteSequence` takes it: the clips' whole canvas
 * over `tile`, stretched across by `stretchX` and then turned by `rotate` (radians
 * clockwise), both about `pivot`. All in the parent's points.
 */
export type GlowPlace = {
    tile: Rect
    pivot?: { x: number; y: number }
    rotate?: number
    stretchX?: number
}

/** MiniGames' `GLOW_FADE_MS`: how long a resting glow takes to come in once it is ready. */
export const GLOW_FADE_MS = 250

/**
 * One of the motion designer's glows: a `Sequence` placed, stretched and turned as
 * MiniGames' `SpriteSequence` does it, and faded by its `level` (MiniGames' `opacity`
 * shared value), which renders nothing new.
 */
export class Glow extends GameObject {
    /** Turned and stretched about the pivot. */
    protected _turn = new PIXI.Container()
    readonly sequence: Sequence
    protected _playId: string | undefined

    constructor(clips: readonly SpriteSheet[], options: SequenceOptions = {}) {
        super()
        this.sequence = new Sequence(clips, options)
        this._turn.addChild(this.sequence)
        this.addChild(this._turn)
        this.alpha = 0
    }

    place({ tile, pivot, rotate = 0, stretchX = 1 }: GlowPlace): void {
        const px = pivot?.x ?? tile.x + tile.width / 2
        const py = pivot?.y ?? tile.y + tile.height / 2
        this._turn.position.set(px, py)
        this._turn.pivot.set(px, py)
        this._turn.rotation = rotate
        this._turn.scale.set(stretchX, 1)
        this.sequence.place({ left: tile.x, top: tile.y, width: tile.width, height: tile.height })
    }

    set rotate(value: number) {
        this._turn.rotation = value
    }

    /**
     * Plays from the start for a new `id` (MiniGames' `playId`), carries on for the same
     * one. Without an id it starts only if it is not playing.
     */
    play(id?: string): void {
        if (id !== undefined ? id !== this._playId : !this.sequence.playing) {
            this._playId = id
            this.sequence.play()
        } else {
            this.sequence.resume()
        }
    }

    /** Stops drawing (MiniGames' `active` false): the next play starts over. */
    stop(): void {
        this._playId = undefined
        this.sequence.stop()
    }

    /** Stands still on its frame (MiniGames' `frozen`). */
    hold(): void {
        this.sequence.hold()
    }

    /** Fades to `level`, 0 to 1, over `ms`. */
    fadeTo(level: number, ms = GLOW_FADE_MS, ease = 'quad.out'): gsap.core.Tween {
        return gsap.to(this, { alpha: level, duration: ms / 1000, ease, overwrite: true })
    }

    override destroy(): void {
        gsap.killTweensOf(this)
        super.destroy()
    }
}

/**
 * A soft top edge as a mask (MiniGames' `softTop`): nothing above `from`, all of it
 * below `to`, a fade between, over `box`. White on clear, so either mask channel reads it.
 */
export function softTopMask(box: Rect, from: number, to: number): PIXI.Sprite {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 256
    const context = canvas.getContext('2d')!
    const gradient = context.createLinearGradient(0, 0, 0, 256)
    const at = (y: number) => Math.min(1, Math.max(0, y / box.height))
    gradient.addColorStop(at(from), 'rgba(255,255,255,0)')
    gradient.addColorStop(Math.max(at(from), at(to)), 'rgba(255,255,255,1)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 1, 256)
    const sprite = new PIXI.Sprite(PIXI.Texture.from(canvas))
    sprite.position.set(box.x, box.y)
    sprite.width = box.width
    sprite.height = box.height
    return sprite
}
