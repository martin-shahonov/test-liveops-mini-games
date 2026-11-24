import { GameObject, PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { SkinFloor } from '../../skin/types'
import type { WheelLayout } from '../layout'
import { fill, texture } from '../../../../shared/view/util'
import { Sequence } from '../../../../shared/view/Sequence'

/**
 * MiniGames' `BackdropFloor`: the tier's floor, the rows the cut video leaves out,
 * drawn over it as a still, with its shines looping over the still once the wheel is lit.
 */
export class Floor extends GameObject {
    protected _still = new PIXI.Sprite()
    protected _shines: Sequence[] = []
    protected _cut?: 'portrait' | 'square'
    protected _lit = false

    constructor(protected _floor: SkinFloor) {
        super()
        this.addChild(this._still)
    }

    layout({ floor }: WheelLayout): void {
        if (!floor) {
            this.visible = false
            return
        }
        this.visible = true
        const cut = this._floor[floor.cut]
        this._still.texture = texture(cut.still.source)
        fill(this._still, floor.place(cut.still.rect))

        if (floor.cut !== this._cut) {
            this._cut = floor.cut
            this._shines.forEach((shine) => shine.destroy())
            this._shines = cut.shines.map((shine) => this.addChild(new Sequence(shine.clips, { loop: true })))
            if (this._lit) this._shines.forEach((shine) => shine.play())
        }
        cut.shines.forEach((shine, i) => this._shines[i]?.place(floor.place(shine.box)))
    }

    /** The shines start together (`play` in MiniGames, once the wheel is revealed). */
    light(): void {
        this._lit = true
        this._shines.forEach((shine) => shine.play())
    }
}
