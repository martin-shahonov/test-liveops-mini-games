import { CompletedStateAction } from '@betty-mini-games/test-liveops-sdk'

import type { DailyScratcherModel } from '../DailyScratcherModel'

/** The reward has gone to the host: the card is done. */
export class DailyScratcherCompletedState extends CompletedStateAction {
    protected override onEnter(): void {
        console.info('[daily-scratcher] collected')
        // Run by a host: COLLECT ends the game.
        ;(this._model as DailyScratcherModel).onClose?.()
    }
}
