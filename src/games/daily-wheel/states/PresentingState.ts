import { PresentingStateAction } from '@betty-mini-games/test-liveops-sdk'

import type { DailyWheelModel } from '../DailyWheelModel'
import type { BoardView } from '../view/BoardView'
import { winTierFor } from '../../../shared/ported/engine'
import { winArtTier } from '../../../shared/ported/win/winScreen'

/**
 * The landing and the win screen: the rim and the landed sector light up, the amount and
 * the pointer lifted over the glow, and the win plays (`WinScreen`): its lockup, the
 * amount counting up, the coin shower. Spin comes back once it is over.
 */
export class DailyWheelPresentingState extends PresentingStateAction {
    protected get model(): DailyWheelModel {
        return this._model as DailyWheelModel
    }

    protected get board(): BoardView {
        return this._views.board as BoardView
    }

    protected override onEnter(): void {
        const { landing, session, spin } = this.model
        const board = this.board
        if (!landing) {
            this.complete()
            return
        }
        const tier = winArtTier(winTierFor(landing.reward.winAmount, landing.sectors))
        console.info('[daily-wheel] landed', landing.reward.winAmount, 'on sector', landing.index, `(${tier})`)
        // A win off the wheel (`OFF_WHEEL`) lights no sector, but is a win all the same.
        if (landing.index >= 0) {
            board.disc.raised = landing.index
            board.landingGlows.landing = { index: landing.index, turn: session.rotation, id: `landing-${spin}` }
        }
        const { sounds } = this.model
        sounds.landed(tier)
        const { over } = board.win.show({
            id: spin,
            tier,
            amount: landing.reward.winAmount,
            onShowerStart: () => sounds.showerStarted(tier),
            onShowerEnd: () => sounds.showerEnded(),
        })
        void over.then(() => {
            board.landingGlows.landing = null
            board.disc.raised = null
            this.complete()
        })
    }
}
