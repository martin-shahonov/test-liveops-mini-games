import { InitStateAction, sound } from '@betty-mini-games/test-liveops-sdk'
import { startsMuted } from '../../../shared/devParams'

import type { DailyScratcherModel } from '../DailyScratcherModel'
import { bindPlay } from '../play/bindPlay'
import type { CardView } from '../view/CardView'

/**
 * The opening: the card is in, the play takes its trays and button over, the button's
 * loop comes in, and the card is offered (MiniGames' reveal, `shown`).
 */
export class DailyScratcherInitState extends InitStateAction {
    protected get card(): CardView {
        return this._views.card as CardView
    }

    protected get model(): DailyScratcherModel {
        return this._model as DailyScratcherModel
    }

    protected override onEnter(): void {
        const { play, card } = this.model
        bindPlay(this.card, play, card, this.model.sounds)
        this.model.sounds.open()
        // A host that kept the player's choice starts the game muted (`?muted=1` presets it).
        if (startsMuted()) {
            this.model.muted = true
            sound.muteAll()
            this.card.topRow.muted = true
        }
        this.card.on('sound', () => {
            this.model.muted = this.model.sounds.toggleMuted()
            this.card.topRow.muted = this.model.muted
        })
        play.show()
        this.card.animations?.show(false)
        this.card.button.glowLit = true
        this.complete()
    }
}
