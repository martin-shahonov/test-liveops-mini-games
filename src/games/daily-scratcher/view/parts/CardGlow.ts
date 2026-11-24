import { GameObject, gsap, PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { BoardFit } from '../../../../shared/ported/runtime'
import { placeBox } from '../../../../shared/ported/runtime/layout/fit'
import { CARD_GLOW, cardGlowCanvas, cardGlowRect } from '../../ported/cardGlowArt'
import type { ScratcherSkin } from '../../ported/skins'

/**
 * MiniGames' `CardGlow`: the ticket lit from behind as a win lands, over its shadow and
 * under its face: her plate grown by `grow` and blurred by `blur`, in her warm light,
 * coming in over `inMs` and going out with the win's glows. Drawn once into a canvas, a
 * point a pixel, and scaled to the board.
 */
export class CardGlow extends GameObject {
    protected _sprite: PIXI.Sprite

    constructor(protected _skin: ScratcherSkin) {
        super()
        const plate = _skin.card.plate
        const canvas = cardGlowCanvas(plate)
        const rect = cardGlowRect(plate)
        const w = Math.ceil(canvas.size[0])
        const h = Math.ceil(canvas.size[1])
        const out = document.createElement('canvas')
        out.width = w
        out.height = h
        const g = out.getContext('2d')!
        // The shape drawn a canvas away and its shadow cast back: a blur every browser draws.
        g.shadowColor = CARD_GLOW.color
        g.shadowBlur = CARD_GLOW.blur * 2
        g.shadowOffsetX = w
        g.fillStyle = CARD_GLOW.color
        g.beginPath()
        g.roundRect(rect.left - w, rect.top, rect.width, rect.height, _skin.card.radius + CARD_GLOW.grow)
        g.fill()
        this._sprite = new PIXI.Sprite(PIXI.Texture.from(out))
        this.addChild(this._sprite)
        this.alpha = 0
    }

    layout(fit: BoardFit): void {
        const box = placeBox(fit, cardGlowCanvas(this._skin.card.plate))
        this._sprite.position.set(box.left, box.top)
        this._sprite.width = box.width
        this._sprite.height = box.height
    }

    /** A win lands: the glow comes in (the win screen takes it out with its glows). */
    light(): void {
        gsap.fromTo(this, { alpha: 0 }, { alpha: CARD_GLOW.alpha, duration: CARD_GLOW.inMs / 1000, ease: 'quad.out', overwrite: true })
    }
}
