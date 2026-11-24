import { GameObject, gsap } from '@betty-mini-games/test-liveops-sdk'

import { PillButton, type PillGlowLoop } from '../../../../shared/view/PillButton'
import type { UiButtonSources } from '../../../../shared/ported/runtime'
import { CARD_BUTTON_SIZE } from '../../ported/buttonPlace'
import type { CardButtonPlace } from '../../ported/cardButtonPlace'

/** The button's two looks: QUICK SCRATCH while the card is played, COLLECT once its outcome shows. */
export type ButtonLook = 'quick' | 'collect'

/** MiniGames' `OVERLAY_FADE_MS`: the cross-fade between the looks. */
const CROSS_FADE_MS = 250

/**
 * MiniGames' `CardButton`: the card's one button in her two words, each the universal
 * button at her `scratcher` size, IDLE, both made from the start and cross-faded as the
 * outcome shows. Only the shown word takes a press; it is drawn busy while it cannot be
 * pressed. The motion designer's loop runs round the shown word's pill while it is offered.
 */
export class CardButton extends GameObject {
    readonly words: Record<ButtonLook, PillButton>
    protected _look: ButtonLook = 'quick'
    protected _offered = false

    constructor(sources: UiButtonSources, labels: Record<ButtonLook, string>, glowLoop?: PillGlowLoop) {
        super()
        const make = (look: ButtonLook) => new PillButton({ sources, label: labels[look], size: CARD_BUTTON_SIZE, glowLoop })
        this.words = { quick: make('quick'), collect: make('collect') }
        this.words.collect.alpha = 0
        this.words.collect.visible = false
        this.addChild(this.words.quick, this.words.collect)
        this.apply()
    }

    get look(): ButtonLook {
        return this._look
    }

    /** Which word shows: COLLECT once the outcome shows, the label changing once. */
    set look(look: ButtonLook) {
        if (look === this._look) return
        const from = this.words[this._look]
        const to = this.words[look]
        this._look = look
        to.visible = true
        gsap.to(from, { alpha: 0, duration: CROSS_FADE_MS / 1000, overwrite: true, onComplete: () => (from.visible = false) })
        gsap.to(to, { alpha: 1, duration: CROSS_FADE_MS / 1000, overwrite: true })
        this.apply()
    }

    /** The shown word can be pressed (MiniGames' `offered` and `enabled`). */
    set offered(offered: boolean) {
        this._offered = offered
        this.apply()
    }

    /** The open has lit the loop round the pill. */
    set glowLit(lit: boolean) {
        this.words.quick.glowLit = lit
        this.words.collect.glowLit = lit
    }

    onPress(look: ButtonLook, handler: (() => void) | undefined): void {
        this.words[look].onPress = handler
    }

    place(place: CardButtonPlace): void {
        this.words.quick.place(place)
        this.words.collect.place(place)
    }

    protected apply(): void {
        for (const look of ['quick', 'collect'] as const) {
            this.words[look].busy = !(look === this._look && this._offered)
            this.words[look].eventMode = look === this._look ? 'static' : 'none'
        }
    }
}
