import { CompleteStateAction, MachineEvents } from '@betty-mini-games/test-liveops-sdk'

import type { DailyWheelModel } from '../DailyWheelModel'
import { isRetryable } from '../ported/wheel/spinController'

/**
 * The spin is over. A prize, or a claim refused with nothing awarded (`reward-unavailable`,
 * `reward-offline`): Spin is offered again. Any other failure locks the wheel, since the
 * claim may have gone through. (The popups: see the UI milestone.)
 */
export class DailyWheelCompleteState extends CompleteStateAction {
    protected get model(): DailyWheelModel {
        return this._model as DailyWheelModel
    }

    protected override onEnter(): void {
        const { error } = this.model
        if (error !== undefined) {
            console.warn('[daily-wheel] the spin failed', error)
            if (!isRetryable(error)) this.model.locked = true
        }
        // Run by a host: one spin, then the game closes.
        if (error === undefined && this.model.onClose) {
            this.model.onClose()
            return
        }
        // A failed claim stops the wheel: Spin comes back once it is at rest.
        const wait = error !== undefined ? 3300 : 0
        setTimeout(() => this.complete({ event: MachineEvents.loop }), wait)
    }
}
