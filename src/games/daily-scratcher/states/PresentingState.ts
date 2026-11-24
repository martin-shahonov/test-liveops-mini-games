import { PresentingStateAction } from '@betty-mini-games/test-liveops-sdk'

import type { DailyScratcherModel } from '../DailyScratcherModel'
import type { CardView } from '../view/CardView'
import { hasWin } from '../ported/screenState'
import { winArtTier } from '../../../shared/ported/win/winScreen'

/**
 * The outcome: a win's screen (MiniGames' `handleWin`): the card lit from behind, its
 * lockup, the coins counted up and the coin shower; COLLECT is offered once it has played
 * out. A card with no match ends as it is, COLLECT offered at once.
 */
export class DailyScratcherPresentingState extends PresentingStateAction {
    protected get model(): DailyScratcherModel {
        return this._model as DailyScratcherModel
    }

    protected get card(): CardView {
        return this._views.card as CardView
    }

    protected override onEnter(): void {
        const { landing, play, scratch } = this.model
        console.info('[daily-scratcher] outcome', JSON.stringify(landing?.outcome), landing?.tier)
        if (!landing || !hasWin(landing.outcome)) {
            this.complete()
            return
        }
        const tier = winArtTier(landing.tier ?? 'nice')
        this.card.cardGlow.light()
        const { sounds } = this.model
        sounds.win(tier)
        const { over } = this.card.win.show({
            id: scratch,
            tier,
            amount: landing.outcome.coins,
            onShowerStart: () => sounds.showerStarted(tier),
            onShowerEnd: () => sounds.showerEnded(),
        })
        void over.then(() => {
            play.offerCollect()
            this.complete()
        })
    }
}
