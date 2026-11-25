import { GameObject, PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { WinScreenArt } from '../types'
import type { BoardFit } from '../ported/runtime/layout/fit'
import { bitmapTextInk } from '../ported/runtime/text/metrics'
import { formatFullAmount } from '../ported/win/formatAmount'
import { coinFlipAt, countUpText, counterRow, WIN_SCREEN } from '../ported/win/winScreen'
import { placeBox } from '../ported/runtime/layout/fit'
import { fill, texture } from './util'
import { BitmapLine } from './BitmapLine'
import { Sequence } from './Sequence'

/**
 * MiniGames' `WinArt` and `WinCounter`: the amount won beside a coin, counting up from
 * when the win's own art comes in and landing on the total `countMs` later, the coin
 * turning over once as it lands. Both rise into place as they fade in (`textIn`) and
 * sink as they fade out (`textOut`).
 */
export class WinCounter extends GameObject {
    protected _coin = new PIXI.Sprite()
    protected _flip?: Sequence
    protected _line?: BitmapLine
    protected _amount = 0
    protected _centre: readonly [number, number] = [0, 0]
    protected _fit?: BoardFit
    protected _counting?: { elapsed: number; countMs: number; flipAt: number; flipped: boolean }
    protected _rise = 0
    textIn = 0
    textOut = 0

    constructor(protected _art: WinScreenArt) {
        super()
        this._coin.texture = texture(_art.coin.source)
        this.addChild(this._coin)
        if (_art.coin.flip) {
            this._flip = new Sequence([_art.coin.flip.clip])
            this.addChild(this._flip)
        }
        this.visible = false
    }

    /** Lays the row out for `amount`'s total about `centre` (board points), so the coin stays put as it counts. */
    set(amount: number, centre: readonly [number, number]): void {
        this._amount = amount
        this._centre = centre
        if (this._fit) this.layout(this._fit)
    }

    layout(fit: BoardFit): void {
        this._fit = fit
        this._rise = WIN_SCREEN.amountRise * fit.k
        const { font, scale } = this._art.counter
        const lineHeight = font.lineHeight * scale
        const total = formatFullAmount(this._amount)
        const row = counterRow(this._centre, this._art.coin, lineHeight, bitmapTextInk(total, font, lineHeight))
        fill(this._coin, placeBox(fit, row.coin))
        const flip = this._art.coin.flip
        if (this._flip && flip) {
            const box = placeBox(fit, { centre: row.coin.centre, size: [flip.size, flip.size] })
            if (box) this._flip.place(box)
        }
        const text = this._line?.text ?? '0'
        this._line?.destroy()
        this._line = new BitmapLine(text, font, lineHeight * fit.k)
        this.addChild(this._line)
        this._row = row
        this.placeLine()
        this.applyFade()
    }

    protected _row?: ReturnType<typeof counterRow>

    /** The text's first glyph image starts at the row's ink, whatever the count spells now. */
    protected placeLine(): void {
        const fit = this._fit
        const row = this._row
        const line = this._line
        if (!fit || !row || !line) return
        const { font, scale } = this._art.counter
        const ink = bitmapTextInk(line.text, font, font.lineHeight * scale)
        line.position.set(fit.offsetX + (row.inkLeft - ink.left) * fit.k, fit.offsetY + row.top * fit.k)
    }

    /** Counts up from nothing over `countMs` (see `countLandsAt`); `flips` turns the coin over as it lands. */
    count(countMs: number, flips: boolean): void {
        this.stopCounting()
        this.visible = true
        const flip = this._art.coin.flip
        const flipMs = flip ? (flip.clip.count / flip.clip.fps) * 1000 : 0
        const flipping = flips && this._flip !== undefined
        this._coin.visible = !flipping
        if (this._flip) {
            this._flip.visible = flipping
            if (flipping) {
                // Face on, on its first frame, until its turn comes.
                this._flip.play()
                this._flip.hold()
            }
        }
        this._counting = { elapsed: 0, countMs, flipAt: coinFlipAt(flipMs, countMs), flipped: !flipping }
        this.setText(countUpText(this._amount, 0, countMs))
        PIXI.Ticker.shared.add(this.tick, this)
    }

    stop(): void {
        this.stopCounting()
        this._flip?.stop()
        this.visible = false
    }

    /** MiniGames' `risen` style. */
    applyFade(): void {
        this.alpha = this.textIn * (1 - this.textOut)
        this.y = this._rise * (1 - this.textIn + this.textOut)
    }

    override destroy(options?: PIXI.DestroyOptions): void {
        this.stop()
        super.destroy(options)
    }

    protected stopCounting(): void {
        if (this._counting) PIXI.Ticker.shared.remove(this.tick, this)
        this._counting = undefined
    }

    protected setText(text: string): void {
        if (!this._line || this._line.text === text) return
        this._line.text = text
        this.placeLine()
    }

    protected tick(ticker: PIXI.Ticker): void {
        const counting = this._counting
        if (!counting) return
        counting.elapsed += ticker.deltaMS
        this.setText(countUpText(this._amount, counting.elapsed, counting.countMs))
        if (!counting.flipped && counting.elapsed >= counting.flipAt) {
            counting.flipped = true
            this._flip?.play()
        }
        if (counting.elapsed >= counting.countMs && counting.flipped) this.stopCounting()
    }
}
