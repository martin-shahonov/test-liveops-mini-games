import { gsap, PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { SpriteSheet, WinScreenArt } from '../types'
import type { BoardBox, BoardSpec } from '../ported/runtime/layout/fit'
import type { WinArtTier } from '../ported/win/types'
import { WIN_SCREEN, countLandsAt, handOverMs } from '../ported/win/winScreen'
import { coinShowerPlacement } from '../ported/win/coinShowerPlacement'
import { winParticlesPlacement, winSparksPlacement } from '../ported/win/winPlacement'
import { placeBox, type BoardFit } from '../ported/runtime/layout/fit'
import { hexColour } from './util'
import { Glow } from './Glow'
import { VfxEffect } from './VfxEffect'
import { WinCounter } from './WinCounter'
import { WinLockup, lockupLightImages } from './WinLockup'

const TIERS: readonly WinArtTier[] = ['nice', 'mega', 'max']

/** A win to show: a new `id` plays it from its start, and seeds its effects. */
export type WinToShow = {
    id: number
    tier: WinArtTier
    amount: number
    /** The shower's first coins: its sound starts. */
    onShowerStart?: () => void
    /** Its last coins have fallen. */
    onShowerEnd?: () => void
}

/** What a game's win screen is made of: the shared art, where it lays it, and the glow behind its piece, if any. */
export type WinScreenOptions = {
    art: WinScreenArt
    /** The game's board: the coin shower is laid on it. */
    spec: BoardSpec
    /** Where the sparks are thrown up from, board points: the wheel's centre, the card's plate. */
    sparksOrigin: readonly [number, number]
    /** The piece lit up from behind, the intro once and the idle looped (the wheel's `WinGlow`). */
    glow?: { intro: SpriteSheet; idle: SpriteSheet; box: BoardBox }
}

/**
 * MiniGames' win screen (`useWinScreen`, `useWinFade` and the game's glow), in two layers
 * a game slots round its piece:
 *
 * - `under`, behind the piece: the glow behind it (the wheel's rays) and the sparks
 *   thrown up from it at the landing;
 * - `over`, over everything but the top row: the dim, the coin shower, the particles,
 *   the tier's lockup and the amount with its coin.
 *
 * Its pace is `WIN_SCREEN`'s: at the landing what the wheel lights; `textAtMs` later the
 * dim with the win's own art; `outAt` into that, all of it plays out; `handOverAfterOutMs`
 * after, the win is over. Run on GSAP, so it pauses with the game.
 */
export class WinScreen {
    readonly under = new PIXI.Container()
    readonly over = new PIXI.Container()
    readonly glow?: Glow
    readonly sparks: VfxEffect
    protected _dim = new PIXI.Graphics()
    protected _showers: Record<WinArtTier, VfxEffect>
    protected _particles: Record<WinArtTier, VfxEffect>
    readonly lockup: WinLockup
    readonly counter: WinCounter
    protected _timeline?: gsap.core.Timeline
    protected _loading = new Map<WinArtTier, Promise<void>>()
    /** What the landing lit besides (the rim's and the sector's glows), faded out with the win glow. */
    protected _lit: PIXI.Container[] = []

    constructor(protected _options: WinScreenOptions) {
        const { art, glow } = _options
        if (glow) {
            this.glow = new Glow([glow.intro, glow.idle], { loop: true })
            this.under.addChild(this.glow)
        }
        this.sparks = new VfxEffect(art.sparks, Object.keys(art.sparks.effects)[0]!)
        this.under.addChild(this.sparks)

        const perTier = (make: (tier: WinArtTier) => VfxEffect) =>
            Object.fromEntries(TIERS.map((tier) => [tier, make(tier)])) as Record<WinArtTier, VfxEffect>
        this._showers = perTier((tier) => new VfxEffect(art.shower.bundle, art.shower.ids[tier]))
        this._particles = perTier((tier) => new VfxEffect(art.particles.bundle, art.particles.ids[tier]))
        this.lockup = new WinLockup(art)
        this.counter = new WinCounter(art)
        this._dim.alpha = 0
        this.over.addChild(
            this._dim,
            ...TIERS.map((tier) => this._showers[tier]),
            ...TIERS.map((tier) => this._particles[tier]),
            this.lockup,
            this.counter,
        )
    }

    layout(layout: { fit: BoardFit; frame: { width: number; height: number } }): void {
        const { fit, frame } = layout
        const { art } = this._options
        const bounds = { width: frame.width, height: frame.height }

        // Over the whole frame, the backdrop's margins included.
        this._dim.clear().rect(0, 0, frame.width, frame.height).fill(hexColour(art.dim.color))

        if (this.glow && this._options.glow) {
            const glow = placeBox(fit, this._options.glow.box)
            this.glow.place({ tile: { x: glow.left, y: glow.top, width: glow.width, height: glow.height } })
        }

        const sparks = winSparksPlacement(fit, this._options.sparksOrigin)
        this.sparks.place({ origin: sparks.origin, pointsPerUnit: sparks.pointsPerUnit }, bounds)
        const shower = coinShowerPlacement(fit, this._options.spec)
        for (const tier of TIERS) {
            this._showers[tier].place(shower, bounds)
            const particles = winParticlesPlacement(fit, art.tiers[tier].particles)
            this._particles[tier].place({ origin: particles.origin, pointsPerUnit: particles.pointsPerUnit }, bounds)
        }
        this.lockup.layout(fit)
        this.counter.layout(fit)
    }

    /**
     * MiniGames' `claimed`: the claim has named the tier coming, so its lockup's lights
     * load now, while the wheel slows onto it. A win whose lights are not in by its
     * landing shows its words at rest.
     */
    prepare(tier: WinArtTier): Promise<void> {
        let loading = this._loading.get(tier)
        if (!loading) {
            const urls = lockupLightImages(this._options.art, tier)
            loading = PIXI.Assets.load(urls.map((url) => ({ alias: url, src: url }))).then(
                () => undefined,
                (error) => {
                    this._loading.delete(tier)
                    console.warn('[daily-wheel] the lockup lights did not load', tier, error)
                },
            )
            this._loading.set(tier, loading)
        }
        void loading.then(() => {
            if (this._loading.has(tier)) this.lockup.light(tier)
        })
        return loading
    }

    /** Fades with the win glow: what the landing lit besides. */
    set lit(containers: PIXI.Container[]) {
        this._lit = containers
    }

    /** Plays `win` from the landing. `over` settles once it is over and Spin may come back. */
    show(win: WinToShow): { over: Promise<void> } {
        this.end(0)
        const { art } = this._options
        const tierArt = art.tiers[win.tier]
        const { outAt, goneAt } = tierArt
        const textAt = WIN_SCREEN.textAtMs / 1000
        const out = textAt + outAt / 1000
        const fade = { textIn: 0, textOut: 0 }
        const applyText = () => {
            this.lockup.textIn = this.counter.textIn = fade.textIn
            this.lockup.textOut = this.counter.textOut = fade.textOut
            this.counter.applyFade()
        }
        applyText()
        this.counter.set(win.amount, tierArt.counter)
        this.lockup.kept = 1

        // At the landing: the piece lit up behind, and the sparks thrown off it.
        if (this.glow) {
            this.glow.alpha = 1
            this.glow.play(`win-${win.id}`)
        }
        this.sparks.play(win.id)

        const timeline = gsap.timeline()
        this._timeline = timeline
        timeline
            .call(
                () => {
                    this.lockup.play(win.tier)
                    // The coin flips where its sheet is in: it is loaded with the board.
                    this.counter.count(countLandsAt(win.amount, outAt), true)
                    this._showers[win.tier].play(win.id, win.onShowerEnd)
                    win.onShowerStart?.()
                    this._particles[win.tier].play(win.id)
                },
                undefined,
                textAt,
            )
            .to(this._dim, { alpha: art.dim.opacity, duration: WIN_SCREEN.dimMs / 1000, ease: 'none' }, textAt)
            .to(fade, { textIn: 1, duration: WIN_SCREEN.amountInMs / 1000, ease: 'quad.out', onUpdate: applyText }, textAt)
            // It all plays out as the lockup starts to swell and pop out.
            .to(this._dim, { alpha: 0, duration: WIN_SCREEN.outMs / 1000, ease: 'none' }, out)
            .to([...(this.glow ? [this.glow] : []), ...this._lit], { alpha: 0, duration: WIN_SCREEN.outMs / 1000, ease: 'none' }, out)
            .to(
                fade,
                { textOut: 1, duration: Math.max(0, goneAt - outAt) / 1000, ease: 'quad.in', onUpdate: applyText },
                out,
            )

        const over = new Promise<void>((resolve) => {
            timeline.call(
                () => {
                    this.lockup.stop()
                    this.counter.stop()
                    this.glow?.stop()
                    resolve()
                },
                undefined,
                handOverMs(outAt) / 1000,
            )
        })
        return { over }
    }

    /** Puts the win away over `ms` (MiniGames' `fadeOutMs`, for a close or a new play). */
    end(ms: number = WIN_SCREEN.fadeOutMs): void {
        const timeline = this._timeline
        if (!timeline) return
        this._timeline = undefined
        timeline.kill()
        const targets = [this._dim, ...(this.glow ? [this.glow] : []), this.lockup, this.counter, ...this._lit]
        const done = () => {
            this.lockup.stop()
            this.counter.stop()
            this.glow?.stop()
            this._dim.alpha = 0
            this.lockup.alpha = this.counter.alpha = 1
        }
        if (ms <= 0) {
            done()
            return
        }
        gsap.to(targets, { alpha: 0, duration: ms / 1000, overwrite: true, onComplete: done })
    }
}
