import { PillButton } from '../../../../shared/view/PillButton'
import type { UiButtonSources, WheelGlows } from '../../skin/types'
import type { WheelLayout } from '../layout'

/** Her board: 3 px to a point. */
const PX = 3

/**
 * MiniGames' `SpinButton`: the universal button at the kit's `spin` size, ACTIVE, in the
 * tier's colour, with the motion designer's loop of light round it.
 */
export class SpinButton extends PillButton {
    constructor(sources: UiButtonSources, colour: string, label: string, glows?: WheelGlows) {
        super({ sources, label, size: 'spin', colour, active: true, glowLoop: glows?.button })
    }

    layout({ boxes, fit }: WheelLayout): void {
        const box = boxes.btnspin
        if (!box) {
            this.visible = false
            return
        }
        this.place({ centre: { x: box.left + box.width / 2, y: box.top + box.height / 2 }, scale: fit.k / PX, span: fit.frameWidth })
    }
}
