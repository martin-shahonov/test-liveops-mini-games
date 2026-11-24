import { MachineEvents, MachineStates, StartingStateAction } from '@betty-mini-games/test-liveops-sdk'

import type { DailyScratcherModel } from '../DailyScratcherModel'
import type { ClaimLanding } from '../ported/scratchController'
import type { CardView } from '../view/CardView'
import { winArtTier } from '../../../shared/ported/win/winScreen'

/**
 * The scratch: the claim is out while the finger or Quick Scratch takes the foil off. On
 * to `resolving` once both boxes are done and the claim has answered; to `complete` if
 * the claim failed.
 */
export class DailyScratcherStartingState extends StartingStateAction {
    protected get model(): DailyScratcherModel {
        return this._model as DailyScratcherModel
    }

    override next() {
        return {
            [MachineEvents.continue]: { target: MachineStates.resolving },
            [MachineEvents.loop]: { target: MachineStates.complete },
        }
    }

    protected _outcome = (landing: ClaimLanding) => {
        this.model.landing = landing
        this.complete()
    }

    /** A win of a tier is coming, ahead of the reveal: its lockup's lights load now. */
    protected _reconciled = (landing: ClaimLanding) => {
        if (!landing.tier) return
        const tier = winArtTier(landing.tier)
        void (this._views.card as CardView).win.prepare(tier)
        this.model.sounds.prepareWin(tier)
    }

    protected _failed = (error: unknown) => {
        this.model.error = error
        this.complete({ event: MachineEvents.loop })
    }

    protected override onEnter(): void {
        this.model.error = undefined
        this.model.scratch += 1
        this.model.play.once('outcome', this._outcome)
        this.model.play.once('failed', this._failed)
        this.model.play.once('reconciled', this._reconciled)
    }

    protected override onExit(): void {
        this.model.play.off('outcome', this._outcome)
        this.model.play.off('failed', this._failed)
        this.model.play.off('reconciled', this._reconciled)
    }
}
