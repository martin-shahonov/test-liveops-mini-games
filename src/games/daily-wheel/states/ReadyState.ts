import { ReadyStateAction } from '@betty-mini-games/test-liveops-sdk'

import type { DailyWheelModel } from '../DailyWheelModel'
import type { BoardView } from '../view/BoardView'
import { jackpotIndices } from '../ported/wheel/jackpot'

/** Spin is offered: a press (or a flick of the wheel) starts a spin. */
export class DailyWheelReadyState extends ReadyStateAction {
    protected get board(): BoardView {
        return this._views.board as BoardView
    }

    protected get model(): DailyWheelModel {
        return this._model as DailyWheelModel
    }

    protected override onEnter(): void {
        const { spin } = this.board
        spin.busy = this.model.locked
        // `idleGlow`: the top prize glows before a spin, and after one that landed nowhere; a
        // win keeps its own glow until the next spin.
        const glowing = jackpotIndices(this.model.sectors)
        this.board.restingGlow =
            this.model.landing === undefined && glowing.length > 0 ? { index: glowing[0]!, id: 'idle' } : null
        spin.onPress = () => {
            if (this.model.locked) return
            this.model.sounds.tap()
            this.model.start = 'instant'
            this.model.release = undefined
            this.complete()
        }
        // Drag-to-spin: a flick released fast and far enough throws the spin from the finger's speed.
        this.model.flick = (release) => {
            if (this.model.locked) return false
            this.model.start = 'flick'
            this.model.release = release
            this.complete()
            return true
        }
    }

    protected override onExit(): void {
        this.model.flick = undefined
        this.board.spin.onPress = undefined
        this.board.spin.busy = true
    }
}
