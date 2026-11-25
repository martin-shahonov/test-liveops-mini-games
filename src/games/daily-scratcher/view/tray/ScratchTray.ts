import { GameObject, PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { PlacedBox } from '../../../../shared/ported/runtime'
import { texture } from '../../../../shared/view/util'
import type { CoinFrame, CoinPlan } from '../../ported/tray/coinMotion'
import { COIN_AWAY } from '../../ported/tray/coinMotion'
import type { CellBox, CellZones } from '../../ported/tray/coverage'
import { BAND_OFF, diagonalOf } from '../../ported/tray/diagonal'
import type { ScratchField } from '../../ported/tray/field'
import type { ColourGrid, FlakePlan } from '../../ported/tray/flakes'
import { QUICK_SWEEP } from '../../ported/tray/quickSweep'
import { revealUniforms } from '../../ported/tray/revealShader'
import type { TrayLane } from '../../ported/tray/stroke'
import {
    endTray,
    initTray,
    runTray,
    type Tell,
    type TrayLoop,
    type TrayPlan,
    type TrayShared,
    type TrayStore,
} from '../../ported/tray/trayMotion'
import { currentTune, type Tune } from '../../ported/tray/tuning'
import type { RevealRule } from '../../ported/rules/reveal'
import { RevealMesh } from './RevealMesh'
import { rgbOf } from '../../ported/tray/colourGrid'

/** Reanimated's shared value, as the ported tray reads and writes it. */
const shared = <T>(value: T): { value: T } => ({ value })

export type ScratchTrayOptions = {
    cells: readonly CellBox[]
    zones?: readonly CellZones[]
    reveal: RevealRule
    /** The tray's size, board points: the coating's box. */
    size: readonly [number, number]
    field: ScratchField
    cellRadius: number
    coating: string
    grit: string
    coinPlan: CoinPlan
    flakePlan: FlakePlan
    reduceMotion: boolean
    /** What the tray tells the screen: see MiniGames' `useScratch`. */
    tell: Tell
}

/**
 * MiniGames' `ScratchTray` with its `useScratch`: one tray's coating over its cells,
 * scratched by the finger. Its state is MiniGames' own (`TrayShared`, run by the ported
 * `trayMotion` on `requestAnimationFrame`): the finger stamps the mask there, the frames
 * read the box, fade the cells and the floor, run Quick Scratch's band and move the coin.
 * This draws it on Pixi's ticker: the mask uploaded whenever it changed, the fades read
 * into the reveal shader.
 */
export class ScratchTray extends GameObject {
    readonly shared: TrayShared
    readonly lane: TrayLane
    readonly mesh: RevealMesh
    protected _plan: TrayPlan
    protected _drawnVersion = -1
    protected _diagonal: { ux: number; uy: number }

    constructor(protected _options: ScratchTrayOptions) {
        super()
        const [width, height] = _options.size
        const tune: Tune = currentTune()
        this.shared = {
            grabbable: shared(false),
            lastBox: shared(true),
            waived: shared<readonly boolean[]>([]),
            still: shared(_options.reduceMotion),
            quick: shared<number | null>(null),
            restore: shared(0),
            warm: shared(false),
            tune: shared(tune),
            colours: shared<ColourGrid | null>(null),
            loop: shared<TrayLoop>({ owner: 0, running: false }),
            store: shared<TrayStore | null>(null),
            maskVersion: shared(0),
            fades: shared<readonly number[]>([]),
            floor: shared(0),
            foilIn: shared(1),
            speed: shared(0),
            moving: shared(false),
            sweep: shared(BAND_OFF),
            flakeFrame: shared(new Float32Array(0)),
            hand: shared<CoinFrame>(COIN_AWAY),
        } as unknown as TrayShared
        this.lane = { shared: this.shared, tell: _options.tell }
        this._plan = {
            cells: _options.cells,
            zones: _options.zones ?? [],
            width,
            height,
            field: _options.field,
            path: false,
            coin: _options.coinPlan,
            flakes: _options.flakePlan,
            reveal: { ..._options.reveal },
        }
        const d = diagonalOf(width, height)
        this._diagonal = { ux: d.ux, uy: d.uy }
        this.mesh = new RevealMesh({
            width,
            height,
            coating: texture(_options.coating),
            grit: texture(_options.grit),
            field: _options.field,
            cells: _options.cells,
            cellRadius: _options.cellRadius,
            uniforms: revealUniforms(_options.field, 3),
        })
        this.addChild(this.mesh)
        initTray(this.shared, this._plan)
        this.run()
        if (!_options.reduceMotion) this.readColours(width, height)
        PIXI.Ticker.shared.add(this.draw, this)
        this.draw()
    }

    /** Lays the tray over `box`, its board points scaled by `k`; the cut's edge antialiased over a device pixel. */
    layout(box: PlacedBox, k: number): void {
        this.position.set(box.left, box.top)
        this.scale.set(k)
        const pixelsPerPoint = k * Math.min(window.devicePixelRatio || 1, 2)
        const u = revealUniforms(this._options.field, pixelsPerPoint)
        const uniforms = (this.mesh.shader!.resources.revealUniforms as PIXI.UniformGroup).uniforms
        uniforms.aa = u.aa
        uniforms.lipAa = u.lipAa
    }

    /** A finger may scratch now (MiniGames' `enabled`). */
    set enabled(value: boolean) {
        this.shared.grabbable.value = value
        this.run()
    }

    /** No other tray is left to scratch (MiniGames' `lastBox`). */
    set lastBox(value: boolean) {
        this.shared.lastBox.value = value
        this.run()
    }

    /** Per cell, whether the box no longer waits on its value (MiniGames' `waived`). */
    set waived(value: readonly boolean[]) {
        this.shared.waived.value = value
        this.run()
    }

    /** A sweep's token, or null: a new value starts Quick Scratch over this tray. */
    set quick(token: number | null) {
        this.shared.quick.value = token
        if (token !== null) this.run()
    }

    /** The card's token: a new value brings the coating back intact. */
    set restore(token: number) {
        this.shared.tune.value = currentTune()
        this.shared.restore.value = token
        this.run()
    }

    /** The coin in the hand, as the tray writes it for the hand. */
    get hand(): CoinFrame {
        return this.shared.hand.value
    }

    /** The flakes, packed for the hand. */
    get flakes(): Float32Array {
        return this.shared.flakeFrame.value
    }

    /**
     * MiniGames' `coatingColours`: the coating's colours, one a point, drawn to cover as the
     * lab's canvas draws it, for the flakes to take theirs from.
     */
    protected readColours(width: number, height: number): void {
        const w = Math.round(width)
        const h = Math.round(height)
        const picture = new Image()
        picture.crossOrigin = 'anonymous'
        picture.src = this._options.coating
        void picture
            .decode()
            .then(() => {
                const iw = picture.naturalWidth
                const ih = picture.naturalHeight
                const canvas = document.createElement('canvas')
                canvas.width = w
                canvas.height = h
                const g = canvas.getContext('2d', { willReadFrequently: true })
                if (!g || !(iw > 0 && ih > 0)) return
                const s = Math.max(w / iw, h / ih)
                const sw = w / s
                const sh = h / s
                g.drawImage(picture, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, w, h)
                this.shared.colours.value = rgbOf(g.getImageData(0, 0, w, h).data, w, h)
            })
            .catch(() => undefined)
    }

    /** MiniGames' `runTray`: the frames run until nothing wants another. */
    run(): void {
        runTray(this.shared, this._options.tell)
    }

    override destroy(options?: PIXI.DestroyOptions): void {
        PIXI.Ticker.shared.remove(this.draw, this)
        endTray(this.shared)
        super.destroy(options)
    }

    /** What MiniGames' scene reads off the shared values each frame. */
    protected draw(): void {
        const s = this.shared
        const store = s.store.value
        if (store && s.maskVersion.value !== this._drawnVersion) {
            this._drawnVersion = s.maskVersion.value
            this.mesh.uploadMask(store.mask)
        }
        const front = s.sweep.value
        const half = QUICK_SWEEP.soft / 2
        this.mesh.setFades(s.fades.value, { ...this._diagonal, near: front - half, far: front + half }, s.floor.value, s.foilIn.value)
    }
}
