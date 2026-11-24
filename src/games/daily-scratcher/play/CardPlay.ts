import { PIXI } from '@betty-mini-games/test-liveops-sdk'

import { cardFaults, isPlayableCard, type ScratcherCard, type ScratcherReward } from '../ported/rules'
import { createScratchController, isRetryable, type ClaimLanding } from '../ported/scratchController'
import {
    bothDone,
    boxDone,
    cellRevealed,
    claimLocked,
    claimReconciled,
    claimRefused,
    claimStarted,
    claimsAgain,
    closed,
    collectDisabled,
    collected,
    collectOffered,
    hasWin,
    initialScreenState,
    needsClaim,
    outcomeShown,
    quickDisabled,
    quickScratched,
    readsCollect,
    shown as shownState,
    strokeStarted,
    traysEnabled,
    unknownSymbols,
    type ScreenPhase,
    type ScreenState,
    type Tray,
} from '../ported/screenState'
import { NO_WIN, OUTCOME_AFTER_MS } from '../ported/screenTiming'
import type { QuickPass } from '../ported/quickScratch'
import { sweepToken } from '../ported/tray/quickSweep'

/** The sounds the play cues (MiniGames' `ScratcherSoundCues`, the part `useCardPlay` calls). */
export type PlayCues = {
    tap(): void
    quick(): void
    reveal(): void
    sweepTick(): void
    match(): void
    nowin(): void
    burst(): void
    lift(): void
    boxDone(tray: Tray): void
}

export const SILENT_CUES: PlayCues = {
    tap() {},
    quick() {},
    reveal() {},
    sweepTick() {},
    match() {},
    nowin() {},
    burst() {},
    lift() {},
    boxDone() {},
}

/** What the play tells the card's states and view. */
export type CardPlayEvents = {
    /** The screen state moved on: the trays, the button and the looks follow it. */
    change: [state: ScreenState]
    /** A tray's Quick Scratch token changed. */
    quick: [tray: Tray, token: number | null]
    /** The claim went out: the scratch has started. */
    claimStarted: []
    /** The claim's outcome, reconciled with the card. */
    reconciled: [landing: ClaimLanding]
    /** Both boxes are revealed and the claim answered: the outcome shows `OUTCOME_AFTER_MS` later. */
    outcome: [landing: ClaimLanding]
    /** The claim failed: refused (the card offered again) or locked. */
    failed: [error: unknown, retryable: boolean]
    /** The player collected: the reward goes to the host. */
    finished: [reward: ScratcherReward]
}

/** The phases in which the foil is taken: a reveal or a box done counts only then. */
const TAKING_FOIL: readonly ScreenPhase[] = ['scratching', 'sweeping']

/**
 * MiniGames' `useCardPlay`, as a plain object: the card's play from the first stroke to
 * COLLECT, on the ported screen reducer (`screenState`) and claim controller
 * (`scratchController`). The trays tell it what the finger and Quick Scratch reveal; it
 * claims the reward once, lights the matches, and shows the outcome once both boxes are
 * done and the claim has answered.
 */
export class CardPlay extends PIXI.EventEmitter<CardPlayEvents> {
    state: ScreenState
    readonly playable: boolean
    protected _claim = createScratchController(() => {})
    protected _timers = new Set<ReturnType<typeof setTimeout>>()
    protected _pending: ClaimLanding | null = null
    protected _sweepNo = 0
    protected _shown = false
    protected _overlay = false

    constructor(
        protected _card: ScratcherCard,
        protected _symbols: readonly string[],
        protected _getReward: () => Promise<ScratcherReward>,
        protected _sweep: QuickPass,
        public cues: PlayCues = SILENT_CUES,
    ) {
        super()
        this.playable = isPlayableCard(_card) && unknownSymbols(_card, _symbols).length === 0
        if (!this.playable) {
            console.warn('[daily-scratcher] the card cannot be played', cardFaults(_card), unknownSymbols(_card, _symbols))
        }
        this.state = initialScreenState(_card, this.playable)
    }

    protected update(next: ScreenState): void {
        if (next === this.state) return
        this.state = next
        this.emit('change', next)
    }

    protected after(ms: number, run: () => void): void {
        const timer = setTimeout(() => {
            this._timers.delete(timer)
            run()
        }, ms)
        this._timers.add(timer)
    }

    protected cancelTimers(): void {
        for (const timer of this._timers) clearTimeout(timer)
        this._timers.clear()
    }

    /** The resting card is on screen: the trays and Quick Scratch answer from now on. */
    show(): void {
        this._shown = true
        this.update(shownState(this.state))
    }

    /** Something lies over the card and takes every touch (How To Play, a popup). */
    set overlay(value: boolean) {
        this._overlay = value
        this.emit('change', this.state)
    }

    protected get context() {
        return { shown: this._shown, overlay: this._overlay }
    }

    get traysEnabled(): boolean {
        return traysEnabled(this.state, this.context)
    }

    get quickOffered(): boolean {
        return traysEnabled(this.state, { shown: this._shown, overlay: false })
    }

    get readsCollect(): boolean {
        return readsCollect(this.state)
    }

    get collectEnabled(): boolean {
        return !collectDisabled(this.state, this.context)
    }

    get claimOffered(): boolean {
        return this._shown && claimsAgain(this.state)
    }

    protected handOver(): void {
        const landing = this._pending
        if (!landing) return
        this._pending = null
        this.emit('finished', landing.reward)
    }

    protected finish(): void {
        this.update(collected(this.state))
        this.handOver()
    }

    /** The win screen has played out: COLLECT is offered. */
    offerCollect(): void {
        this.update(collectOffered(this.state))
    }

    protected startClaim(): void {
        void this._claim.claim({
            card: this._card,
            getReward: this._getReward,
            onStart: () => {
                this.update(claimStarted(this.state))
                this.emit('claimStarted')
            },
            onReconciled: (landing) => {
                this.update(claimReconciled(this.state, landing.outcome).state)
                this.emit('reconciled', landing)
            },
            onShow: (landing) => {
                this.update(claimReconciled(this.state, landing.outcome).state)
                this._pending = landing
                if (this.state.phase === 'closed') {
                    this.handOver()
                    return
                }
                this.after(OUTCOME_AFTER_MS, () => {
                    this.update(outcomeShown(this.state))
                    if (!hasWin(landing.outcome)) {
                        this.cues.nowin()
                        if (NO_WIN.handOverMs !== null) this.after(NO_WIN.handOverMs, () => this.finish())
                    }
                    this.emit('outcome', landing)
                })
            },
            onError: (error) => {
                this.cancelTimers()
                const retryable = isRetryable(error)
                this.update(retryable ? claimRefused(this.state) : claimLocked(this.state))
                this.cues.lift()
                console.warn('[daily-scratcher] the scratch failed', error)
                this.emit('failed', error, retryable)
            },
        })
    }

    /** A tray's first stroke: the claim, once per card. */
    strokeStart(): void {
        const next = strokeStarted(this.state)
        if (next === this.state) return
        this.update(next)
        if (needsClaim(next)) this.startClaim()
    }

    protected takingFoil(): boolean {
        return TAKING_FOIL.includes(this.state.phase)
    }

    cellRevealed(tray: Tray, index: number): void {
        if (!this.takingFoil()) return
        const step = cellRevealed(this.state, this._card, tray, index)
        if (step.state === this.state) return
        const sweeping = this.state.phase === 'sweeping'
        this.update(step.state)
        if (!sweeping) this.cues.reveal()
        for (let i = 0; i < step.lit.yours.length; i++) this.cues.match()
        if (step.burst) this.cues.burst()
    }

    boxDone(tray: Tray): void {
        if (!this.takingFoil()) return
        this.cues.boxDone(tray)
        const step = boxDone(this.state, tray, this._card)
        if (step.state === this.state) return
        this.update(step.state)
        for (let i = 0; i < step.lit.yours.length; i++) this.cues.match()
        if (step.burst) this.cues.burst()
        if (bothDone(step.state)) {
            this.cues.lift()
            this._claim.revealed()
        }
    }

    /** QUICK SCRATCH: the band over each tray not yet done, the winning one first. */
    quick(): void {
        if (quickDisabled(this.state, this.context)) return
        this.cues.tap()
        const next = quickScratched(this.state)
        if (next === this.state) return
        this.update(next)
        if (needsClaim(next)) this.startClaim()
        if (this.state.phase !== 'sweeping') return
        this.cues.quick()
        this.cues.lift()
        this._sweepNo += 1
        const token = sweepToken(this.state.restore, this._sweepNo)
        const { done } = this.state
        const swept = { winning: !done.winning, yours: !done.yours }
        if (swept.winning) {
            this.emit('quick', 'winning', token)
            if (swept.yours) this.after(this._sweep.handOverMs, () => this.emit('quick', 'yours', token))
        } else {
            this.emit('quick', 'yours', token)
        }
        const yoursFrom = swept.winning ? this._sweep.handOverMs : 0
        for (const ms of this._sweep.ticksMs(swept)) {
            const tray: Tray = swept.yours && ms >= yoursFrom ? 'yours' : 'winning'
            this.after(ms, () => {
                if (!this.state.done[tray]) this.cues.sweepTick()
            })
        }
    }

    /** Retry or Try again on a popup: the card claimed again, as it is. */
    claimAgain(): void {
        if (!this._shown || !claimsAgain(this.state)) return
        this.startClaim()
    }

    collect(): void {
        if (collectDisabled(this.state, this.context)) return
        this.cues.tap()
        this.finish()
    }

    close(): void {
        this.cancelTimers()
        this.handOver()
        this.update(closed(this.state))
        this._claim.setLive(false)
    }
}
