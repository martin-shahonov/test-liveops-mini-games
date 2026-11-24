import { GameObject, gsap, PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { PlacedBox } from '../../../../shared/ported/runtime'
import { fill, texture } from '../../../../shared/view/util'
import { CELL_DIM, NO_WIN, OVERLAY_FADE_MS } from '../../ported/screenTiming'

/**
 * MiniGames' `CellDims` and `NoWinPlate`: as a card with no match ends, its cells dim,
 * then the screen dims and the no-win plate rises into place over the card, under the
 * button, which reads COLLECT over it.
 */
export class NoWin extends GameObject {
    protected _cells = new PIXI.Graphics()
    protected _dim = new PIXI.Graphics()
    protected _plate: PIXI.Sprite
    protected _rise = { value: 1 }
    protected _k = 1
    protected _plateBox?: PlacedBox

    constructor(
        source: string,
        protected _overlayDim: number,
        protected _reduceMotion: boolean,
    ) {
        super()
        this._plate = new PIXI.Sprite(texture(source))
        this._cells.alpha = 0
        this._dim.alpha = 0
        this._plate.alpha = 0
        this.addChild(this._cells, this._dim, this._plate)
        this.visible = false
    }

    layout(cells: readonly PlacedBox[], radius: number, plate: PlacedBox, frame: { width: number; height: number }, k: number): void {
        this._k = k
        this._plateBox = plate
        this._cells.clear()
        for (const cell of cells) this._cells.roundRect(cell.left, cell.top, cell.width, cell.height, radius).fill(0x000000)
        this._dim.clear().rect(0, 0, frame.width, frame.height).fill(0x000000)
        fill(this._plate, plate)
        this.applyRise()
    }

    show(): void {
        if (this.visible) return
        this.visible = true
        gsap.to(this._cells, { alpha: CELL_DIM.opacity, duration: CELL_DIM.ms / 1000 })
        gsap.to(this._dim, { alpha: this._overlayDim, duration: OVERLAY_FADE_MS / 1000 })
        gsap.to(this._plate, { alpha: 1, duration: OVERLAY_FADE_MS / 1000 })
        this._rise.value = this._reduceMotion ? 0 : 1
        if (!this._reduceMotion) {
            gsap.to(this._rise, { value: 0, duration: NO_WIN.riseMs / 1000, ease: 'cubic.out', onUpdate: () => this.applyRise() })
        }
        this.applyRise()
    }

    protected applyRise(): void {
        if (this._plateBox) this._plate.y = this._plateBox.top + this._rise.value * NO_WIN.risePt * this._k
    }
}
