import { GameObject, PIXI, Vfx } from '@betty-mini-games/test-liveops-sdk'

import type { VfxBundle } from '../types'
import { texture } from './util'

/**
 * Where an effect's world lands on the board, as MiniGames' `SpriteProjection`: world
 * (0, 0) at `origin`, `pointsPerUnit` points a world unit, +Y up, and its heights drawn
 * at `heightScale` of their size (the coin shower's flatter arc).
 */
export type VfxPlacement = {
    origin: { x: number; y: number }
    pointsPerUnit: number
    heightScale?: number
}

/** The file MiniGames' exporter baked nixie-fx's procedural soft circle into. */
const SOFT_CIRCLE = 'proc:circle:0.750:64'

/**
 * MiniGames' `VfxEffect`: one effect of a nixie-fx export, run by nixie-fx's own Pixi
 * renderer on the ticker, from `play()` until every particle has gone. Its textures are
 * the bundle's files, loaded with the board.
 */
export class VfxEffect extends GameObject {
    protected _instance: Vfx.PixiVfxEffectInstance
    protected _placement: VfxPlacement = { origin: { x: 0, y: 0 }, pointsPerUnit: 1 }
    protected _running = false
    protected _time = 0
    protected _emitFor: number
    protected _onFinished?: () => void

    constructor(bundle: VfxBundle, effectId: string) {
        super()
        const effect = bundle.effects[effectId]
        if (!effect) throw new Error(`[daily-wheel] no effect "${effectId}" in the bundle`)
        const fallback = Vfx.createPixiVfxProceduralTextures()
        const soft = bundle.textures[SOFT_CIRCLE]
        if (soft) fallback.circle = texture(soft)
        this._instance = new Vfx.PixiVfxEffectInstance({
            effect,
            autoStart: false,
            fallbackTextures: fallback,
            textureProvider: {
                getTexture: (ref) => {
                    const url = bundle.textures[ref.path]
                    return url ? texture(url) : undefined
                },
            },
            projection: {
                project: (world) => ({
                    x: this._placement.origin.x + world[0] * this._placement.pointsPerUnit,
                    y:
                        this._placement.origin.y -
                        world[1] * this._placement.pointsPerUnit * (this._placement.heightScale ?? 1),
                    visible: true,
                }),
                pixelsPerWorldUnit: () => this._placement.pointsPerUnit,
            },
        })
        const timeline = this._instance.definition.timeline
        this._emitFor = timeline.loop.enabled ? Infinity : timeline.duration
        this.addChild(this._instance.root)
        this.visible = false
    }

    place(placement: VfxPlacement, bounds: { width: number; height: number }): void {
        this._placement = placement
        this._instance.setBoundsArea(new PIXI.Rectangle(0, 0, bounds.width, bounds.height))
    }

    get playing(): boolean {
        return this._running
    }

    /** From its start, `seed` choosing its particles; `onFinished` once it has nothing left to show. */
    play(seed: number, onFinished?: () => void): void {
        this._onFinished = onFinished
        this._time = 0
        this._instance.spawn({ seed, timeSeconds: 0 })
        this.visible = true
        if (!this._running) {
            this._running = true
            PIXI.Ticker.shared.add(this.tick, this)
        }
    }

    stop(): void {
        if (this._running) {
            this._running = false
            PIXI.Ticker.shared.remove(this.tick, this)
        }
        this._instance.stop()
        this.visible = false
    }

    override destroy(): void {
        this.stop()
        this._instance.destroy()
        super.destroy()
    }

    protected tick(ticker: PIXI.Ticker): void {
        // A stalled frame pauses the effect rather than jumping every particle ahead.
        const dt = Math.min(ticker.deltaMS, 100) / 1000
        this._time += dt
        if (this._time >= this._emitFor) {
            // MiniGames' simulation: emission is over once its timeline is, the last particles still fall.
            ;(this._instance as unknown as { runner?: { allowCompletion?: () => void } }).runner?.allowCompletion?.()
        }
        const alive = this._instance.update(dt)
        if (!alive) {
            const done = this._onFinished
            this.stop()
            done?.()
        }
    }
}
