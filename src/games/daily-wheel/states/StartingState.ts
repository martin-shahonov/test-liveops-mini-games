import { MachineEvents, MachineStates, StartingStateAction } from '@betty-mini-games/test-liveops-sdk'

import type { DailyWheelModel } from '../DailyWheelModel'
import type { BoardView } from '../view/BoardView'

/**
 * The throw: the wheel leaves rest and the claim goes out together. On to `resolving`
 * once the claim has answered with a prize the wheel can land on; straight to
 * `complete` if it failed.
 */
export class DailyWheelStartingState extends StartingStateAction {
    protected get model(): DailyWheelModel {
        return this._model as DailyWheelModel
    }

    protected get board(): BoardView {
        return this._views.board as BoardView
    }

    override next() {
        return {
            [MachineEvents.continue]: { target: MachineStates.resolving },
            [MachineEvents.loop]: { target: MachineStates.complete },
        }
    }

    protected override onEnter(): void {
        const model = this.model
        // Nothing glows while the wheel turns: the resting glow goes, and a last win's glows go out.
        const board = this.board
        board.restingGlow = null
        void board.landingGlows.goOut(250).then(() => (board.disc.raised = null))
        model.sounds.spinStarted(model.start)
        model.spin += 1
        model.landing = undefined
        model.error = undefined
        const run = model.session.spin(model.sectors, model.start, model.release)
        model.run = run
        let moved = false
        run.landed.then((landing) => {
            if (moved) return
            moved = true
            model.landing = landing
            this.complete()
        })
        run.failed.then((error) => {
            model.error = error
            if (moved) return
            moved = true
            this.complete({ event: MachineEvents.loop })
        })
    }
}
