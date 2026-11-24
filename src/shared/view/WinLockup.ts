import { GameObject, PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { LockupLight, LockupWord, WinScreenArt } from '../types'
import type { BoardFit } from '../ported/runtime/layout/fit'
import type { LockupElement, TierMotion, WinArtTier } from '../ported/win/types'
import { elementState, lockupFrame, type LockupState } from '../ported/win/lockupClock'
import { LOCKUP_HOLD_FRAMES, WIN_PIXEL } from '../ported/win/winBoxes'
import { placeBox } from '../ported/runtime/layout/fit'
import { texture } from './util'
import { sheetTextures } from './sheetTexture'
import { Sequence } from './Sequence'

const TIERS: readonly WinArtTier[] = ['nice', 'mega', 'max']

/** The images every lockup's lights are cut from: decoded only for the tier a claim names. */
export function lockupLightImages(art: WinScreenArt, tier: WinArtTier): string[] {
    const { glows, passes } = art.tiers[tier].lockup.lights
    return [...new Set([glows.tier, glows.win, ...passes].flatMap((light) => [...light.clip.images]))]
}

/** An image drawn over its box at rest, moved, scaled and faded about that box's centre. */
class Moving {
    readonly sprite = new PIXI.Sprite()
    protected _centre = { x: 0, y: 0 }
    protected _size = { width: 0, height: 0 }

    constructor(protected _box: LockupWord['box']) {
        this.sprite.anchor.set(0.5)
        this.sprite.alpha = 0
    }

    layout(fit: BoardFit): void {
        const box = placeBox(fit, this._box)!
        this._centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 }
        this._size = { width: box.width, height: box.height }
        this.atRest(this.sprite.alpha)
    }

    /** MiniGames' `played` style: the clock's `[scale, dx, dy, opacity]`, its moves in art px. */
    show([scale, dx, dy, opacity]: LockupState, perArtPixel: number, kept: number): void {
        const { sprite } = this
        sprite.position.set(this._centre.x + dx * perArtPixel, this._centre.y + dy * perArtPixel)
        sprite.width = this._size.width
        sprite.height = this._size.height
        sprite.scale.set(sprite.scale.x * scale, sprite.scale.y * scale)
        sprite.alpha = opacity * kept
    }

    /** At rest, at `alpha` (MiniGames' `still` style). */
    atRest(alpha: number): void {
        this.show([1, 0, 0, alpha], 0, 1)
    }
}

/**
 * MiniGames' `WinLockup`: the tier word over WIN, stills moved, scaled and faded from the
 * export's motion, frame by frame (eased between frames), with the glow each comes in with
 * moved and faded alongside, and the passes of light that cross them once they settle.
 *
 * A win whose lights have not loaded by its landing shows the words at rest instead,
 * fading with the amount (`still`).
 */
export class WinLockup extends GameObject {
    protected _words: Record<WinArtTier, { tier: Moving; win: Moving }>
    protected _lights = new PIXI.Container()
    protected _lit?: {
        tier: WinArtTier
        glows: { tier: Moving; win: Moving }
        passes: Sequence[]
    }
    protected _playing?: { tier: WinArtTier; motion: TierMotion; mode: 'played' | 'still'; elapsed: number }
    protected _fit?: BoardFit
    /** MiniGames' `WinFade` values the words read. */
    kept = 1
    textIn = 0
    textOut = 0

    constructor(protected _art: WinScreenArt) {
        super()
        this._words = Object.fromEntries(
            TIERS.map((tier) => {
                const { words } = _art.tiers[tier].lockup
                const make = (word: LockupWord) => {
                    const moving = new Moving(word.box)
                    moving.sprite.texture = texture(word.source)
                    this.addChild(moving.sprite)
                    return moving
                }
                return [tier, { tier: make(words.tier), win: make(words.win) }]
            }),
        ) as Record<WinArtTier, { tier: Moving; win: Moving }>
        // Added over every tier's words.
        this.addChild(this._lights)
        this.visible = false
    }

    /** The tier's lights, built once their images have loaded (see `lockupLightImages`). */
    light(tier: WinArtTier): void {
        if (this._lit?.tier === tier) return
        this.unlight()
        const { glows, passes } = this._art.tiers[tier].lockup.lights
        const glow = (light: LockupLight) => {
            const moving = new Moving(light.box)
            // Its one frame, held: moved and faded with its word.
            moving.sprite.texture = sheetTextures(light.clip)[0] ?? PIXI.Texture.EMPTY
            moving.sprite.blendMode = 'add'
            this._lights.addChild(moving.sprite)
            return moving
        }
        this._lit = {
            tier,
            glows: { tier: glow(glows.tier), win: glow(glows.win) },
            passes: passes.map((pass) => {
                const sequence = new Sequence([pass.clip])
                this._lights.addChild(sequence)
                return sequence
            }),
        }
        if (this._fit) this.layout(this._fit)
    }

    /** The lights' textures are freed: a tier's are 10 to 22 MB decoded. */
    unlight(): void {
        if (!this._lit) return
        this._lights.removeChildren().forEach((child) => child.destroy())
        this._lit = undefined
    }

    get litTier(): WinArtTier | undefined {
        return this._lit?.tier
    }

    layout(fit: BoardFit): void {
        this._fit = fit
        for (const tier of TIERS) {
            this._words[tier].tier.layout(fit)
            this._words[tier].win.layout(fit)
        }
        if (this._lit) {
            this._lit.glows.tier.layout(fit)
            this._lit.glows.win.layout(fit)
            const { passes } = this._art.tiers[this._lit.tier].lockup.lights
            this._lit.passes.forEach((sequence, i) => {
                const box = placeBox(fit, passes[i]!.box)
                if (box) sequence.place(box)
            })
        }
    }

    /** Plays `tier`'s lockup from now: its motion where its lights are in, its words at rest otherwise. */
    play(tier: WinArtTier): void {
        this.stop()
        const motion = this._art.tiers[tier].lockup.motion
        const mode = this._lit?.tier === tier ? 'played' : 'still'
        this._playing = { tier, motion, mode, elapsed: 0 }
        this.visible = true
        if (mode === 'played') this._lit!.passes.forEach((pass) => pass.play())
        PIXI.Ticker.shared.add(this.tick, this)
        this.draw()
    }

    stop(): void {
        if (this._playing) PIXI.Ticker.shared.remove(this.tick, this)
        this._playing = undefined
        this._lit?.passes.forEach((pass) => pass.stop())
        for (const tier of TIERS) {
            this._words[tier].tier.sprite.alpha = 0
            this._words[tier].win.sprite.alpha = 0
        }
        if (this._lit) {
            this._lit.glows.tier.sprite.alpha = 0
            this._lit.glows.win.sprite.alpha = 0
        }
        this.visible = false
    }

    override destroy(): void {
        this.stop()
        super.destroy()
    }

    protected tick(ticker: PIXI.Ticker): void {
        if (!this._playing) return
        this._playing.elapsed += ticker.deltaMS
        this.draw()
    }

    protected draw(): void {
        const playing = this._playing
        const fit = this._fit
        if (!playing || !fit) return
        const words = this._words[playing.tier]
        if (playing.mode === 'still') {
            const alpha = this.textIn * (1 - this.textOut)
            words.tier.atRest(alpha)
            words.win.atRest(alpha)
            return
        }
        const { motion } = playing
        const e = lockupFrame(motion, playing.elapsed, LOCKUP_HOLD_FRAMES)
        const perArtPixel = WIN_PIXEL * fit.k
        const show = (moving: Moving, element: LockupElement) =>
            moving.show(elementState(element, motion.frames, e), perArtPixel, this.kept)
        show(words.tier, motion.words.tier)
        show(words.win, motion.words.win)
        show(this._lit!.glows.tier, motion.glows.tier)
        show(this._lit!.glows.win, motion.glows.win)
        this._lit!.passes.forEach((pass) => (pass.alpha = this.kept))
    }
}
