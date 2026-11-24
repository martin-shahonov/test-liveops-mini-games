import { GameObject, PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { WheelSkin } from '../../skin/types'
import { placeBox, type WheelLayout } from '../layout'
import { fill, texture } from '../../../../shared/view/util'
import { Glow, softTopMask } from '../../../../shared/view/Glow'
import { titleGlowFade, titleGlowWhole } from '../../ported/wheel/glowArt'

/**
 * MiniGames' `WheelTitle`: the tier's word over DAILY WHEEL, each stretched over its box,
 * and the motion designer's sweep over both, looped. The sweep was painted over one
 * tier's word: over another's it draws DAILY WHEEL's part alone, under a soft top edge.
 */
export class Title extends GameObject {
    protected _tier = new PIXI.Sprite()
    protected _game = new PIXI.Sprite()
    readonly glow?: Glow
    protected _softTop?: PIXI.Sprite
    /** The sweep has come round again (MiniGames' `onGlowLoop`): the shimmer sounds on it. */
    onGlowLoop?: () => void

    constructor(protected _skin: WheelSkin) {
        super()
        this._tier.texture = texture(_skin.sources.titletier)
        this._game.texture = texture(_skin.sources.titlegame)
        this.addChild(this._tier, this._game)
        const title = _skin.glows?.title
        if (title) {
            this.glow = new Glow([title.loop], { loop: true, onLoop: () => this.onGlowLoop?.() })
            this.addChild(this.glow)
        }
    }

    layout({ boxes, fit }: WheelLayout): void {
        fill(this._tier, boxes.titletier)
        fill(this._game, boxes.titlegame)

        const title = this._skin.glows?.title
        if (!this.glow || !title) return
        const box = placeBox(fit, title.box)
        if (!box) {
            this.glow.visible = false
            return
        }
        this.glow.visible = true
        const tile = { x: box.left, y: box.top, width: box.width, height: box.height }
        this.glow.place({ tile })

        if (this._softTop) {
            this.glow.mask = null
            this._softTop.destroy({ texture: true, textureSource: true })
            this._softTop = undefined
        }
        if (!titleGlowWhole(title, boxes.titletier ? this._skin.loyaltyTier : null)) {
            const { from, to } = titleGlowFade(box.height, title.loop.sourceHeight, title.split)
            this._softTop = softTopMask(tile, from, to)
            this.addChild(this._softTop)
            this.glow.mask = this._softTop
        }
    }
}
