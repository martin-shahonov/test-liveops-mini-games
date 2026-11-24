import { PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { BitmapFont, BoardFit } from '../../../../shared/ported/runtime'
import { BitmapLine } from '../../../../shared/view/BitmapLine'
import { inkLineBox, type InkLinePlace } from '../../ported/valueLine'

/**
 * MiniGames' `ValueLine`: one line of a value, the coin and the amount, or of the top
 * prize, from a glyph sheet where `inkLinePlace` puts it. Laid out again on every fit.
 */
export class ValueText extends PIXI.Container {
    protected _line?: BitmapLine

    constructor(
        readonly text: string,
        protected _font: BitmapFont,
        protected _place: InkLinePlace,
    ) {
        super()
    }

    layout(fit: BoardFit): void {
        const box = inkLineBox(fit, this._font, this._place)
        this._line?.destroy({ children: true })
        this._line = new BitmapLine(this.text, this._font, box.size)
        this._line.position.set(box.left, box.top)
        this.addChild(this._line)
    }
}
