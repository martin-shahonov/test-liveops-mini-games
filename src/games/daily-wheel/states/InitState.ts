import { InitStateAction } from '@betty-mini-games/test-liveops-sdk'

import type { BoardView } from '../view/BoardView'
import type { DailyWheelModel } from '../DailyWheelModel'

/**
 * The opening (MiniGames' `useOpenSequence`): the board is in, the floor's shines start,
 * and the resting wheel's glows come in one after another. Spin is offered at once:
 * the open never waits on the glows.
 */
export class DailyWheelInitState extends InitStateAction {
    protected get board(): BoardView {
        return this._views.board as BoardView
    }

    protected override onEnter(): void {
        this.board.floor?.light()
        ;(this._model as DailyWheelModel).sounds.open()
        void this.board.lightGlows()
        this.complete()
    }
}
