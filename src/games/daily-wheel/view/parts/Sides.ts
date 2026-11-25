import { GameObject, PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { SideTone, SkinSides } from '../../skin/types'
import type { WheelLayout } from '../layout'
import { SIDE_SHADE } from '../../ported/wheel/sidePlacement'

/**
 * MiniGames' `BackdropSides`: on a frame wider than the square cut, the scene's
 * sides, each a column of the backdrop's edge colours, shaded towards the cut and
 * melting into it over the fade. Painted once per size into a canvas.
 */
export class Sides extends GameObject {
    protected _left = new PIXI.Sprite()
    protected _right = new PIXI.Sprite()
    protected _key = ''

    constructor(protected _sides: SkinSides) {
        super()
        this.addChild(this._left, this._right)
    }

    layout({ sides, fit }: WheelLayout): void {
        if (!sides) {
            this.visible = false
            return
        }
        this.visible = true
        const { square, width, fade } = sides
        const right = square.left + square.width
        const height = fit.frameHeight
        const key = [square.left, square.top, square.height, width, height].map(Math.round).join()
        if (key === this._key) return
        this._key = key

        const shared = { rows: this._sides.rows, fade, top: square.top, squareHeight: square.height, height }
        this.paint(this._left, this._sides.left, square.left, shared)
        this._left.position.set(0, 0)
        this.paint(this._right, this._sides.right, width - right, shared)
        // Mirrored, its fade reaching left into the cut.
        this._right.scale.x = -1
        this._right.position.set(right - fade + (width - right + fade), 0)
    }

    protected paint(
        sprite: PIXI.Sprite,
        tone: SideTone,
        band: number,
        { rows, fade, top, squareHeight, height }: { rows: number; fade: number; top: number; squareHeight: number; height: number },
    ): void {
        const resolution = Math.min(window.devicePixelRatio || 1, 2)
        const w = Math.max(1, Math.ceil(band + fade))
        const h = Math.max(1, Math.ceil(height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(w * resolution)
        canvas.height = Math.ceil(h * resolution)
        const ctx = canvas.getContext('2d')!
        ctx.scale(resolution, resolution)

        const toneGradient = () => {
            const gradient = ctx.createLinearGradient(0, top, 0, top + squareHeight)
            for (const [row, colour] of tone) gradient.addColorStop(Math.min(1, (row + 0.5) / rows), colour)
            return gradient
        }
        // The band, its tone, shaded towards the cut.
        ctx.fillStyle = toneGradient()
        ctx.fillRect(0, 0, band, h)
        const shade = ctx.createLinearGradient(0, 0, band, 0)
        shade.addColorStop(0, `rgba(0,0,0,${SIDE_SHADE})`)
        shade.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = shade
        ctx.fillRect(0, 0, band, h)
        // The fade over the cut: the tone, masked from opaque to clear.
        const faded = document.createElement('canvas')
        faded.width = canvas.width
        faded.height = canvas.height
        const fctx = faded.getContext('2d')!
        fctx.scale(resolution, resolution)
        fctx.fillStyle = (() => {
            const gradient = fctx.createLinearGradient(0, top, 0, top + squareHeight)
            for (const [row, colour] of tone) gradient.addColorStop(Math.min(1, (row + 0.5) / rows), colour)
            return gradient
        })()
        fctx.fillRect(band, 0, fade, h)
        fctx.globalCompositeOperation = 'destination-in'
        const mask = fctx.createLinearGradient(band, 0, band + fade, 0)
        mask.addColorStop(0, 'rgba(255,255,255,1)')
        mask.addColorStop(1, 'rgba(255,255,255,0)')
        fctx.fillStyle = mask
        fctx.fillRect(band, 0, fade, h)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.drawImage(faded, 0, 0)

        if (sprite.texture !== PIXI.Texture.EMPTY) sprite.texture.destroy(true)
        // At the canvas's own resolution, so the sprite is w x h points as drawn.
        sprite.texture = new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: canvas, resolution }) })
    }

    override destroy(options?: PIXI.DestroyOptions): void {
        for (const side of [this._left, this._right]) {
            if (side.texture !== PIXI.Texture.EMPTY) side.texture.destroy(true)
        }
        super.destroy(options)
    }
}
