import { GameObject } from '@betty-mini-games/test-liveops-sdk'

import type { BoardFit } from '../../../../shared/ported/runtime'
import { placeBox } from '../../../../shared/ported/runtime/layout/fit'
import { Glow } from '../../../../shared/view/Glow'
import { CARD_ANIMATION_TIMING, cardAnimationBoxes, cardAnimationClips } from '../../ported/cardAnimationPlan'
import type { ScratcherSkin } from '../../ported/skins'

/**
 * MiniGames' `CardAnimations`: the motion designer's animations every card plays, over
 * the card's art and its coatings: the rim's and the title's loops, and his one flourish
 * as the card is first shown, the TOP PRIZE plaque's light once and the fields' sweep,
 * which stops for good at the card's first stroke or Quick Scratch.
 */
export class CardAnimations extends GameObject {
    protected _fields: Glow
    protected _topPrize: Glow
    protected _title: Glow
    protected _rim: Glow
    protected _flourish: boolean | null = null

    constructor(protected _skin: ScratcherSkin & { animations: NonNullable<ScratcherSkin['animations']> }) {
        super()
        const clips = cardAnimationClips(_skin.animations)
        this._fields = new Glow(clips.fields, { loop: true })
        this._topPrize = new Glow(clips.topPrize)
        this._title = new Glow(clips.title, { loop: true })
        this._rim = new Glow(clips.rim, { loop: true })
        this.addChild(this._fields, this._topPrize, this._title, this._rim)
    }

    layout(fit: BoardFit): void {
        const boxes = cardAnimationBoxes(this._skin)
        const at = (glow: Glow, name: keyof typeof boxes) => {
            const box = placeBox(fit, boxes[name])
            glow.place({ tile: { x: box.left, y: box.top, width: box.width, height: box.height } })
        }
        at(this._fields, 'fields')
        at(this._topPrize, 'topPrize')
        at(this._title, 'title')
        at(this._rim, 'rim')
    }

    /** The card is shown: the loops come in, and the flourish too unless the card was already played. */
    show(played: boolean): void {
        if (this._flourish !== null) return
        this._flourish = !played
        const inMs = CARD_ANIMATION_TIMING.inMs
        for (const glow of [this._title, this._rim]) {
            glow.play()
            glow.fadeTo(1, inMs)
        }
        if (this._flourish) {
            this._topPrize.play()
            this._topPrize.fadeTo(1, inMs)
            this._fields.play()
            this._fields.fadeTo(1, inMs)
        }
    }

    /** The card's first stroke or Quick Scratch: the fields' sweep goes, and never comes back. */
    played(): void {
        if (!this._fields.sequence.playing) return
        this._fields.fadeTo(0, CARD_ANIMATION_TIMING.fieldsOutMs).eventCallback('onComplete', () => this._fields.stop())
    }

    /** How To Play or a popup is up: everything stands still on its frame. */
    set frozen(frozen: boolean) {
        for (const glow of [this._fields, this._topPrize, this._title, this._rim]) {
            if (frozen) glow.hold()
            else if (glow.sequence.playing) glow.sequence.resume()
        }
    }
}

/** MiniGames' `BackGlow`: the glow behind the ticket, a card with a match's alone, on while its win's glows are. */
export class BackGlow extends GameObject {
    protected _glow: Glow
    protected _on = false

    constructor(protected _skin: ScratcherSkin & { animations: NonNullable<ScratcherSkin['animations']> }) {
        super()
        this._glow = new Glow([_skin.animations.back.sheet], { loop: true })
        this.addChild(this._glow)
    }

    layout(fit: BoardFit): void {
        const box = placeBox(fit, cardAnimationBoxes(this._skin).back)
        this._glow.place({ tile: { x: box.left, y: box.top, width: box.width, height: box.height } })
    }

    set lit(on: boolean) {
        if (on === this._on) return
        this._on = on
        const ms = CARD_ANIMATION_TIMING.winFadeMs
        if (on) {
            this._glow.play()
            this._glow.fadeTo(1, ms)
        } else {
            this._glow.fadeTo(0, ms).eventCallback('onComplete', () => this._glow.stop())
        }
    }
}
