import { GameObject, PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { BitmapFont, BoardFit, PlacedBox } from '../../../../shared/ported/runtime'
import { fill, texture } from '../../../../shared/view/util'
import { tileFor, type CellArt, type TileArt } from '../../ported/cardCells'
import { tileGlowBox } from '../../ported/cardLayout'
import { CARD_ANIMATION_TIMING, tileAnimationBox } from '../../ported/cardAnimationPlan'
import type { ScratcherAnimations } from '../../ported/skins'
import { Glow } from '../../../../shared/view/Glow'
import { SYMBOL_POP, symbolLightLevel, symbolPopScale } from '../../ported/symbolPop'
import { UNMATCHED_DARK } from '../../ported/screenTiming'
import type { CellBox } from '../../ported/tray'
import type { CardLayoutOnScreen } from '../layout'
import { ValueText } from './ValueText'

/** How a cell's art shows: at rest, lit (a match the engine has called) or dark (no part in a win). */
export type CellLook = 'rest' | 'lit' | 'dark'

/** MiniGames' `MATCH_GLOW`: a lit glow fades in, then breathes with the card's one pulse. */
export const MATCH_GLOW = { fadeMs: 300, pulseMs: 2400, low: 0.6 }

/** MiniGames' `pulseLevel` / `glowLevel` / `restOpacity`. */
const pulseLevel = (phase: number, low: number) => low + ((1 - low) * (1 + Math.cos(2 * Math.PI * phase))) / 2
const glowLevel = (fade: number, phase: number, low: number) => fade * pulseLevel(phase, low)
const restOpacity = (level: number) => 1 - level

/** An eased level, as `useEasedLevel` runs it: towards its target over `ms`, quad out. */
class Eased {
    value = 0
    protected _from = 0
    protected _to = 0
    protected _at = 0

    constructor(protected _ms: number) {}

    set(on: boolean, now: number, still = false): void {
        const to = on ? 1 : 0
        if (to === this._to) return
        this._from = this.value
        this._to = to
        this._at = now
        if (still) this.value = to
    }

    step(now: number): void {
        const t = Math.min(1, (now - this._at) / this._ms)
        const eased = 1 - (1 - t) * (1 - t)
        this.value = this._from + (this._to - this._from) * eased
    }
}

/** One slot: its tile and its looks, the cell's symbol and value with theirs. */
type Slot = {
    box: CellBox
    tileArt: TileArt
    tile: PIXI.Sprite
    tileMatch: PIXI.Sprite
    tileDark: PIXI.Sprite
    tileGlow: PIXI.Sprite
    look: CellLook
    fade: Eased
    /** When its match lit, ms, or -1: its pop's clock. */
    litAt: number
    symbol?: { holder: PIXI.Container; base: PIXI.Sprite; dark: PIXI.Sprite; lightHolder: PIXI.Container; light: PIXI.Sprite; shadow: PIXI.Sprite; grown: number }
    value?: { base: ValueText; dark?: ValueText; glow?: ValueText }
    /** The motion designer's glows on a lit tile: behind its symbol, and round its frame. */
    tileBack?: Glow
    tileFrame?: Glow
    glowsOn: boolean
}

/**
 * MiniGames' `CardCells` for one tray, under its coating: every slot's tile, then each
 * symbol's shadow and the symbol, then the YOUR SYMBOLS values, with her win state drawn
 * in them. A lit cell's tile gives way to her matched tile as its glow fades in and
 * breathes with the card's pulse, and its symbol pops and is lit; once a win is known
 * every lit symbol pops again and every other tile, symbol and value gives way to its
 * darkened copy. The glows stay inside the field's core until the box is done.
 */
export class Cells extends GameObject {
    protected _glows = new PIXI.Container()
    protected _glowClip = new PIXI.Graphics()
    protected _tiles = new PIXI.Container()
    protected _tileBacks = new PIXI.Container()
    protected _tileFrames = new PIXI.Container()
    protected _shadows = new PIXI.Container()
    protected _symbols = new PIXI.Container()
    protected _lights = new PIXI.Container()
    protected _valueGlows = new PIXI.Container()
    protected _valueGlowClip = new PIXI.Graphics()
    protected _values = new PIXI.Container()
    protected _slots: Slot[]
    protected _darkness = new Eased(UNMATCHED_DARK.ms)
    protected _againAt = -1
    protected _boxDone = false
    protected _fit?: BoardFit
    protected _core?: { box: PlacedBox; radius: number }
    /** The card's one pulse: its phase, 0 to 1, shared by every tray (see `CardView`). */
    pulse = { phase: 0 }
    reduceMotion = false

    constructor(
        slots: readonly CellBox[],
        tiles: readonly TileArt[],
        readonly art: readonly CellArt[],
        protected _tileGlowGrow: number,
        protected _coreBox: { box: CellBox; radius: number },
        values?: { font: BitmapFont; glow: BitmapFont; dark: BitmapFont },
        protected _tileGlows?: ScratcherAnimations['tile'],
    ) {
        super()
        const sprite = (source: string) => new PIXI.Sprite(texture(source))
        this._slots = slots.map((box, i) => {
            const tileArt = tileFor(tiles, box.width)
            const slot: Slot = {
                box,
                tileArt,
                tile: sprite(tileArt.source),
                tileMatch: sprite(tileArt.match),
                tileDark: sprite(tileArt.dark),
                tileGlow: sprite(tileArt.glow),
                look: 'rest',
                fade: new Eased(MATCH_GLOW.fadeMs),
                litAt: -1,
                glowsOn: false,
            }
            if (_tileGlows) {
                slot.tileBack = new Glow([_tileGlows.back], { loop: true })
                slot.tileFrame = new Glow([_tileGlows.frameIn, _tileGlows.frameIdle], { loop: true })
                this._tileBacks.addChild(slot.tileBack)
                this._tileFrames.addChild(slot.tileFrame)
            }
            slot.tileMatch.visible = slot.tileDark.visible = slot.tileGlow.visible = false
            this._glows.addChild(slot.tileGlow)
            this._tiles.addChild(slot.tileMatch, slot.tileDark, slot.tile)
            const cell = art[i]
            if (cell?.symbol) {
                const holder = new PIXI.Container()
                const dark = sprite(cell.symbol.dark)
                const base = sprite(cell.symbol.source)
                const light = sprite(cell.symbol.source)
                const lightHolder = new PIXI.Container()
                lightHolder.addChild(light)
                light.blendMode = 'add'
                lightHolder.visible = false
                for (const s of [dark, base, light]) s.anchor.set(0.5)
                dark.visible = false
                holder.addChild(dark, base)
                slot.symbol = {
                    holder,
                    base,
                    dark,
                    lightHolder,
                    light,
                    shadow: sprite(cell.symbol.shadow.source),
                    grown: cell.symbol.matched.width / cell.symbol.box.width,
                }
                this._shadows.addChild(slot.symbol.shadow)
                this._symbols.addChild(holder)
                this._lights.addChild(lightHolder)
            }
            if (cell?.value && values) {
                const base = new ValueText(cell.value.text, values.font, cell.value.place)
                const dark = new ValueText(cell.value.text, values.dark, cell.value.place)
                const glow = new ValueText(cell.value.text, values.glow, cell.value.place)
                dark.visible = glow.visible = false
                slot.value = { base, dark, glow }
                this._valueGlows.addChild(glow)
                this._values.addChild(dark, base)
            }
            return slot
        })
        this._glows.mask = this._glowClip
        this._valueGlows.mask = this._valueGlowClip
        this.addChild(
            this._glowClip,
            this._glows,
            this._tiles,
            this._tileBacks,
            this._shadows,
            this._symbols,
            this._lights,
            this._valueGlowClip,
            this._valueGlows,
            this._values,
            this._tileFrames,
        )
        PIXI.Ticker.shared.add(this.step, this)
    }

    override destroy(): void {
        PIXI.Ticker.shared.remove(this.step, this)
        super.destroy()
    }

    /**
     * The cells lit and whether a win is known (`darkensUnmatched`): a lit cell pops at its
     * match, and every lit one again, together, once the win is known.
     */
    setLooks(lit: readonly number[], darken: boolean): void {
        const now = performance.now()
        this._slots.forEach((slot, i) => {
            const look: CellLook = lit.includes(i) ? 'lit' : darken ? 'dark' : 'rest'
            if (look === 'lit' && slot.litAt < 0) slot.litAt = now
            if (look !== 'lit') slot.litAt = -1
            slot.look = look
            slot.fade.set(look === 'lit', now, this.reduceMotion)
            slot.tileMatch.visible = look === 'lit'
            slot.tileDark.visible = look === 'dark'
            slot.tileGlow.visible = look === 'lit'
            if (slot.symbol) {
                slot.symbol.dark.visible = look === 'dark'
                slot.symbol.lightHolder.visible = look === 'lit'
            }
            if (slot.value) {
                slot.value.dark!.visible = look === 'dark'
                slot.value.glow!.visible = look === 'lit'
            }
        })
        if (darken && this._againAt < 0) this._againAt = now
        this.setTileGlows()
        this._darkness.set(darken, now, this.reduceMotion)
    }

    /** The win's glows are on: false once the card has gone, when they fade out. */
    set glowsOn(on: boolean) {
        this._glowsOn = on
        this.setTileGlows()
    }

    protected _glowsOn = true

    /** His glows on every lit tile, while the win's glows are on. */
    protected setTileGlows(): void {
        const ms = CARD_ANIMATION_TIMING.winFadeMs
        for (const slot of this._slots) {
            const on = slot.look === 'lit' && this._glowsOn
            if (on === slot.glowsOn || !slot.tileBack || !slot.tileFrame) continue
            slot.glowsOn = on
            if (on) {
                slot.tileBack.play()
                slot.tileBack.fadeTo(1, ms)
                slot.tileFrame.play()
                slot.tileFrame.alpha = 1
            } else {
                for (const glow of [slot.tileBack, slot.tileFrame]) {
                    glow.fadeTo(0, ms).eventCallback('onComplete', () => glow.stop())
                }
            }
        }
    }

    /** Every cell of this tray is revealed: the glows may spread past the field. */
    set boxDone(done: boolean) {
        if (done === this._boxDone) return
        this._boxDone = done
        this.clipGlows()
    }

    layout({ fit, onScreen }: CardLayoutOnScreen): void {
        this._fit = fit
        this._core = { box: onScreen(this._coreBox.box), radius: this._coreBox.radius * fit.k }
        this._slots.forEach((slot, i) => {
            fill(slot.tile, onScreen(slot.box))
            fill(slot.tileMatch, onScreen(slot.box))
            fill(slot.tileDark, onScreen(slot.box))
            fill(slot.tileGlow, onScreen(tileGlowBox(slot.box, this._tileGlowGrow)))
            if (this._tileGlows && slot.tileBack && slot.tileFrame) {
                const tile = onScreen(slot.box)
                const { box, stretchX } = tileAnimationBox(tile, this._tileGlows.scale)
                const at = { tile: { x: box.left, y: box.top, width: box.width, height: box.height }, stretchX }
                slot.tileBack.place(at)
                slot.tileFrame.place(at)
            }
            const symbol = this.art[i]?.symbol
            if (symbol && slot.symbol) {
                fill(slot.symbol.shadow, onScreen(symbol.shadow.box))
                // Laid out at its matched size, the size its image ships for, drawn at its size at rest.
                const box = onScreen(symbol.matched)
                slot.symbol.holder.position.set(box.left + box.width / 2, box.top + box.height / 2)
                slot.symbol.lightHolder.position.copyFrom(slot.symbol.holder.position)
                for (const s of [slot.symbol.base, slot.symbol.dark, slot.symbol.light]) {
                    s.width = box.width
                    s.height = box.height
                }
            }
            if (slot.value) {
                slot.value.base.layout(fit)
                slot.value.dark?.layout(fit)
                slot.value.glow?.layout(fit)
            }
        })
        this.clipGlows()
    }

    /** The glows kept to the field's core, rounded, until the box is done. */
    protected clipGlows(): void {
        const core = this._core
        for (const clip of [this._glowClip, this._valueGlowClip]) {
            clip.clear()
            if (!core) continue
            if (this._boxDone) clip.rect(-1e4, -1e4, 2e4, 2e4).fill(0xffffff)
            else clip.roundRect(core.box.left, core.box.top, core.box.width, core.box.height, core.radius).fill(0xffffff)
        }
    }

    protected step(): void {
        const now = performance.now()
        this._darkness.step(now)
        const dark = this._darkness.value
        const phase = this.pulse.phase
        const low = MATCH_GLOW.low
        const motion = !this.reduceMotion
        const popAgain = this._againAt
        this._slots.forEach((slot) => {
            slot.fade.step(now)
            const glow = glowLevel(slot.fade.value, phase, low)
            slot.tile.alpha = slot.look === 'lit' ? restOpacity(glow) : slot.look === 'dark' ? restOpacity(dark) : 1
            slot.tileGlow.alpha = glow
            const since = slot.litAt >= 0 ? (now - slot.litAt) / 1000 : -1
            const again = popAgain >= 0 && slot.litAt >= 0 ? (now - popAgain) / 1000 : -1
            const handover = again >= 0 && popAgain - slot.litAt < SYMBOL_POP.lengthS * 1000 ? 1 : 0
            if (slot.symbol) {
                const pop = motion ? symbolPopScale(since, again, handover) : 1
                const scale = pop / slot.symbol.grown
                slot.symbol.holder.scale.set(scale)
                slot.symbol.base.alpha = slot.look === 'dark' ? restOpacity(dark) : 1
                if (slot.look === 'lit') {
                    slot.symbol.lightHolder.scale.set(scale)
                    slot.symbol.lightHolder.alpha = symbolLightLevel(since, again, 1, motion ? 1 : 0)
                }
            }
            if (slot.value) {
                slot.value.base.alpha = slot.look === 'lit' ? 1 : slot.look === 'dark' ? restOpacity(dark) : 1
                if (slot.value.glow) slot.value.glow.alpha = glow
            }
        })
    }
}
