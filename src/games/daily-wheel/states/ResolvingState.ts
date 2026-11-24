import { ResolvingStateAction } from '@betty-mini-games/test-liveops-sdk'

import type { DailyWheelModel } from '../DailyWheelModel'
import type { BoardView } from '../view/BoardView'
import { winTierFor } from '../../../shared/ported/engine'
import { winArtTier } from '../../../shared/ported/win/winScreen'

/**
 * The settle: the wheel slows onto the landing's sector over 6.6 s. The claim has said
 * what was won, so the win's lockup lights load meanwhile (MiniGames' `claimed`). On to
 * `presenting` at rest.
 */
export class DailyWheelResolvingState extends ResolvingStateAction {
    protected get model(): DailyWheelModel {
        return this._model as DailyWheelModel
    }

    protected get board(): BoardView {
        return this._views.board as BoardView
    }

    protected override onEnter(): void {
        const landing = this.model.landing
        if (landing) {
            const tier = winArtTier(winTierFor(landing.reward.winAmount, landing.sectors))
            void this.board.win.prepare(tier)
            this.model.sounds.prepareWin(tier)
        }
        this.model.run?.settled.then(() => this.complete())
    }
}
