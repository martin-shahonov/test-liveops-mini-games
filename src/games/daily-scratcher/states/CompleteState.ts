import { CompleteStateAction, MachineEvents } from '@betty-mini-games/test-liveops-sdk'

import type { DailyScratcherModel } from '../DailyScratcherModel'
import { isRetryable } from '../ported/scratchController'

/**
 * The card is over: COLLECT hands the reward to the host and ends the game. A claim
 * refused with nothing awarded offers the card again, its foil back on; any other failure
 * locks it. (The popups: see the UI milestone.)
 */
export class DailyScratcherCompleteState extends CompleteStateAction {
    protected get model(): DailyScratcherModel {
        return this._model as DailyScratcherModel
    }

    protected _finished = () => this.complete({ event: MachineEvents.end })

    protected override onEnter(): void {
        const { error, play } = this.model
        if (error !== undefined) {
            if (isRetryable(error)) {
                this.complete({ event: MachineEvents.loop })
            } else {
                this.model.locked = true
            }
            return
        }
        play.once('finished', this._finished)
    }

    protected override onExit(): void {
        this.model.play.off('finished', this._finished)
    }
}
