import { GameObject, PIXI, Vfx } from '@betty-mini-games/test-liveops-sdk'

import type { VfxBundle } from '../types'
import { texture } from './util'

/**
 * nixie-fx 0.1.6 workaround: while an effect plays, `drawParticleViews()` re-resolves every emitter
 * each frame (`ensureEmitterViews()` → `resolveEmitterRender()`), cutting new frame textures for
 * sprite-sheet emitters. When the emitter's view already has the same render key it drops them
 * without destroying them, and each stays registered on the shared particle image for good.
 * Here those dropped frames are destroyed. Remove once nixie-fx fixes this.
 */
type EmitterRender = { key: string; ownedFrameTextures: PIXI.Texture[] }
type EffectInternals = { effect: { emitters: unknown[] }; emitterViews: ({ key: string } | undefined)[] }
const effectProto = Vfx.PixiVfxEffectInstance.prototype as unknown as {
    resolveEmitterRender?: (this: EffectInternals, emitter: unknown) => EmitterRender
}
const resolveRender = effectProto.resolveEmitterRender
if (resolveRender) {
    effectProto.resolveEmitterRender = function (emitter) {
        const render = resolveRender.call(this, emitter)
        const view = this.emitterViews[this.effect.emitters.indexOf(emitter)]
        if (view?.key === render.key) {
            for (const made of render.ownedFrameTextures) made.destroy(false)
            render.ownedFrameTextures.length = 0
        }
        return render
    }
}

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
    /** The particle textures drawn for this effect (not the bundle's shared art): destroyed with it. */
    protected _ownTextures: PIXI.Texture[]
    protected _onFinished?: () => void

    constructor(bundle: VfxBundle, effectId: string) {
        super()
        const effect = bundle.effects[effectId]
        if (!effect) throw new Error(`[daily-wheel] no effect "${effectId}" in the bundle`)
        // nixie-fx draws five small textures for each effect, into PixiJS's global cache: the effect
        // does not own them (they are passed in), so this one destroys them, else each game open
        // would leave five canvases behind.
        const fallback = Vfx.createPixiVfxProceduralTextures()
        const soft = bundle.textures[SOFT_CIRCLE]
        if (soft) {
            fallback.circle.destroy(true)
            fallback.circle = texture(soft)
        }
        this._ownTextures = Object.values(fallback).filter((made) => !soft || made !== fallback.circle)
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

    override destroy(options?: PIXI.DestroyOptions): void {
        this.stop()
        this._instance.destroy()
        this._ownTextures.forEach((made) => made.destroy(true))
        super.destroy(options)
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
