import { ReadyStateAction } from '@betty-mini-games/test-liveops-sdk'

import type { DailyScratcherModel } from '../DailyScratcherModel'

/** The card is offered: a stroke on a tray, or QUICK SCRATCH, sends the claim out. */
export class DailyScratcherReadyState extends ReadyStateAction {
    protected get model(): DailyScratcherModel {
        return this._model as DailyScratcherModel
    }

    protected _started = () => this.complete()

    protected override onEnter(): void {
        this.model.play.once('claimStarted', this._started)
    }

    protected override onExit(): void {
        this.model.play.off('claimStarted', this._started)
    }
}
