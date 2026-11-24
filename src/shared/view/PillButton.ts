import { GameObject, gsap, PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { SpriteSheet } from '../types'
import type { UiButtonSources } from '../ported/runtime'
import { hexColour, texture } from './util'
import { BUTTON_TOKENS, FACE_COVER, pressDrop, type UiButtonSize, type UiButtonSizeClass } from '../ported/runtime/ui/tokens'
import { buttonLayout } from '../ported/runtime/ui/button/buttonLayout'
import { UI_LABEL_FONT } from './fonts'
import { glowRing } from '../ported/runtime/ui/button/glowRing'
import { Glow } from './Glow'

/** Where the button draws: its middle, the scale her px are drawn at (a board's k / 3) and the frame's width it is centred across. */
export type PillPlace = { centre: { x: number; y: number }; scale: number; span: number }

/** The motion designer's loop round a pill (MiniGames' `glowRing` art): its sheet and its bright line's size in the sheet. */
export type PillGlowLoop = { loop: SpriteSheet; line: { width: number; height: number } }

export type PillButtonOptions = {
    sources: UiButtonSources
    label: string
    /** The kit's size class, or a game's own (`CARD_BUTTON_SIZE`). */
    size: UiButtonSize | UiButtonSizeClass
    /** The pill's fill: the kit's base colour unless given (a Daily Wheel tier's SPIN). */
    colour?: string
    /** The designer's ACTIVE state, its face lit and its glow on, as SPIN rests. IDLE otherwise. */
    active?: boolean
    /** A loop of light run round the pill while it can be pressed. */
    glowLoop?: PillGlowLoop
}

const { master, label: LABEL, press: PRESS } = BUTTON_TOKENS
/** MiniGames' `BUSY_OPACITY`: a button that takes no press. */
const BUSY_OPACITY = 0.55
/** MiniGames' `PRESS_TUNE.busyFadeMs`: the glow loop fades out as Spin goes busy, and in as it comes back. */
const BUSY_FADE_MS = 300

/** One of the kit's 3-sliced sprites: caps at their own width, the middle stretched. */
function slice(source: string, w0: number, h0: number, cap: number): PIXI.NineSliceSprite {
    return new PIXI.NineSliceSprite({
        texture: texture(source),
        leftWidth: cap,
        rightWidth: cap,
        topHeight: 0,
        bottomHeight: 0,
        width: w0,
        height: h0,
    })
}

/**
 * MiniGames' `UniversalButton`: in its ACTIVE state its glow under the pill, the fill in
 * the button's colour, the face over it (lit when ACTIVE), the frame, and the word in
 * Inter Black with its shadow. A press sinks it (scale 0.97, the pressed face and word,
 * the word's drop); a busy button is faded. A game's loop of light can run round it.
 */
export class PillButton extends GameObject {
    protected _glow?: PIXI.NineSliceSprite
    protected _fill = new PIXI.Graphics()
    protected _faceRest: PIXI.NineSliceSprite
    protected _facePressed: PIXI.NineSliceSprite
    protected _frame: PIXI.NineSliceSprite
    protected _word: PIXI.Text
    protected _pill = new PIXI.Container()
    protected _look = { value: 0 }
    protected _busy = false
    protected _drop = 0
    protected _onPress?: () => void
    /** The motion designer's loop round the pill, moving with its press. */
    readonly glow?: Glow
    protected _ring = new PIXI.Container()
    protected _glowLit = false

    protected _colour: string
    protected _active: boolean
    protected _glows?: PillGlowLoop

    constructor(protected _options: PillButtonOptions) {
        super()
        const { sources, label } = _options
        this._colour = _options.colour ?? BUTTON_TOKENS.baseHex
        this._active = _options.active ?? false
        this._glows = _options.glowLoop
        if (this._active) this._glow = slice(sources.glow, master.glowW, master.glowH, master.glowCap)
        this._faceRest = slice(this._active ? sources.faceActive : sources.faceIdle, master.frameW, master.fileH, master.cap)
        this._facePressed = slice(sources.facePressed, master.frameW, master.fileH, master.cap)
        this._frame = slice(sources.frame, master.frameW, master.fileH, master.cap)
        this._facePressed.alpha = 0
        this._word = new PIXI.Text({
            text: label.toUpperCase(),
            style: {
                fontFamily: `${UI_LABEL_FONT}, sans-serif`,
                fill: LABEL.idle,
                fontWeight: 'normal',
                dropShadow: {
                    color: LABEL.shadowIdle.color,
                    alpha: LABEL.shadowIdle.opacity,
                    angle: Math.PI / 2,
                    blur: 0,
                    distance: 0,
                },
            },
        })
        this._word.anchor.set(0.5)
        if (this._glow) this._pill.addChild(this._glow)
        this._pill.addChild(this._fill, this._faceRest, this._facePressed, this._frame, this._word)
        if (this._glows) {
            this.glow = new Glow([this._glows.loop], { loop: true })
            this._ring.addChild(this.glow)
            this._pill.addChild(this._ring)
        }
        this.addChild(this._pill)

        this._pill.eventMode = 'static'
        this._pill.cursor = 'pointer'
        this._pill.on('pointerdown', this.pressIn, this)
        this._pill.on('pointerup', this.pressOut, this)
        this._pill.on('pointerupoutside', this.pressOut, this)
        this._pill.on('pointertap', () => {
            if (!this._busy) this._onPress?.()
        })
    }

    set onPress(handler: (() => void) | undefined) {
        this._onPress = handler
    }

    /** Takes no press, faded (MiniGames' `busy`). */
    set busy(value: boolean) {
        if (value === this._busy) return
        this._busy = value
        this._pill.cursor = value ? 'default' : 'pointer'
        gsap.to(this._pill, { alpha: value ? BUSY_OPACITY : 1, duration: 0.2, ease: 'sine.out', overwrite: true })
        this.runGlow()
    }

    /** The open has lit the loop (MiniGames' `glowActive`): it fades in, and loops while the button can be pressed. */
    set glowLit(value: boolean) {
        if (value === this._glowLit) return
        this._glowLit = value
        if (value) this.glow?.fadeTo(1)
        this.runGlow()
    }

    /** `loopOn`: playing while lit and pressable, or still fading out as the button goes busy. */
    protected runGlow(): void {
        const glow = this.glow
        if (!glow) return
        if (this._glowLit && !this._busy) {
            glow.play()
            gsap.to(this._ring, { alpha: 1, duration: BUSY_FADE_MS / 1000, ease: 'sine.out', overwrite: true })
        } else {
            gsap.to(this._ring, {
                alpha: 0,
                duration: this._glowLit ? BUSY_FADE_MS / 1000 : 0,
                ease: 'sine.out',
                overwrite: true,
                onComplete: () => glow.hold(),
            })
        }
    }

    get busy(): boolean {
        return this._busy
    }

    /** Where the pill is on screen, for the button's glow loop. */
    get pillBounds(): { x: number; y: number; width: number; height: number } {
        return { x: this._pill.x - this._width / 2, y: this._pill.y - this._height / 2, width: this._width, height: this._height }
    }

    protected _width = 0
    protected _height = 0

    /** Lays the button out about `place.centre`. */
    place({ centre, scale, span }: PillPlace): void {
        this.visible = true
        const snap = (points: number) => Math.round(points * window.devicePixelRatio) / window.devicePixelRatio
        const size = this._options.size
        const layout = buttonLayout(size, scale, snap)
        const { H, k } = layout
        this._drop = pressDrop(typeof size === 'string' ? BUTTON_TOKENS.sizes[size].H : size.H) * scale

        // Shadow as React Native's: a blur radius of twice the sigma.
        const style = this._word.style
        style.fontSize = layout.fontSize
        style.dropShadow = {
            color: LABEL.shadowIdle.color,
            alpha: LABEL.shadowIdle.opacity,
            angle: Math.PI / 2,
            distance: LABEL.shadowIdle.offsetYPx * scale,
            blur: LABEL.shadowIdle.blurSigmaPx * scale * 2,
        }
        const width = Math.max(layout.minWidth, this._word.width + 2 * layout.pad)
        this._width = width
        this._height = H

        // Slices drawn at file size, scaled to the pill's height.
        const sized = (sprite: PIXI.NineSliceSprite, w: number, h: number, s: number, x: number, y: number) => {
            sprite.scale.set(s)
            sprite.width = w / s
            sprite.height = h / s
            sprite.scale.set(s)
            sprite.position.set(x, y)
        }
        const left = -width / 2
        const top = -H / 2
        for (const face of [this._faceRest, this._facePressed, this._frame]) {
            sized(face, width, H, k, left, top)
        }
        const glowK = layout.glow.height / master.glowH
        if (this._glow) sized(this._glow, width - 2 * layout.glow.side, layout.glow.height, glowK, left + layout.glow.side, top + layout.glow.top)

        this._fill.clear()
        this._fill
            .roundRect(left + layout.fillInset, top + layout.fillInset, width - 2 * layout.fillInset, H - 2 * layout.fillInset, H)
            .fill(hexColour(this._colour))

        this._word.position.set(0, this._look.value * this._drop)
        this._pill.position.set(centre.x, centre.y)
        if (this.glow && this._glows) {
            const loop = this._glows.loop
            const ring = glowRing(
                { centre: { x: 0, y: 0 }, width, height: H },
                { canvas: { width: loop.sourceWidth, height: loop.sourceHeight }, line: this._glows.line },
                span,
            )
            this.glow.place({
                tile: { ...ring.tile, x: ring.box.left + ring.tile.x, y: ring.box.top + ring.tile.y },
                pivot: { x: 0, y: 0 },
                stretchX: ring.stretchX,
            })
        }
        this._pill.hitArea = new PIXI.Rectangle(left, top, width, H)
        this.applyLook()
    }

    protected pressIn(): void {
        if (this._busy) return
        gsap.to(this._look, { value: 1, duration: PRESS.downMs / 1000, ease: 'sine.out', overwrite: true, onUpdate: () => this.applyLook() })
    }

    protected pressOut(): void {
        gsap.to(this._look, { value: 0, duration: PRESS.upMs / 1000, ease: 'sine.out', overwrite: true, onUpdate: () => this.applyLook() })
    }

    /** MiniGames' `faceLooks` / `pillTransform` / `wordLooks` at a press `look` from 0 (rest) to 1 (down). */
    protected applyLook(): void {
        const p = this._look.value
        this._faceRest.alpha = 1 - p
        this._facePressed.alpha = p / (1 - (this._active ? FACE_COVER.active : FACE_COVER.idle) * (1 - p))
        const s = 1 - (1 - PRESS.scale) * p
        this._pill.scale.set(s)
        this._word.y = p * this._drop
        this._word.style.fill = p > 0.5 ? LABEL.pressed : LABEL.idle
    }
}
