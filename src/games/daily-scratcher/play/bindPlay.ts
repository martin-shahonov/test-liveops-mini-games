import { darkensUnmatched, shownLit, waivedValues, type ScreenState } from '../ported/screenState'
import { cardGone, cardPlayed, matchLit } from '../ported/cardAnimationPlan'
import type { ScratcherCard } from '../ported/rules'
import type { CardView, TrayName } from '../view/CardView'
import type { CardPlay } from './CardPlay'
import type { ScratcherSounds } from '../sound/ScratcherSounds'

/**
 * What MiniGames' screen hands its trays and its button from the play's state, on every
 * change: the trays take a finger while the play allows it, each knows whether the other
 * box is done, YOUR SYMBOLS whether a value is still waited for, and both the card's
 * restore token; the button shows QUICK SCRATCH, then COLLECT, offered as the play says.
 */
export function bindPlay(view: CardView, play: CardPlay, card: ScratcherCard, sounds?: ScratcherSounds): () => void {
    view.tells = {
        winning: (report, index, value) => tell('winning', report, index, value),
        yours: (report, index, value) => tell('yours', report, index, value),
    }
    function tell(tray: TrayName, report: string, index: number, value: number): void {
        if (report === 'stroke') play.strokeStart()
        else if (report === 'cell') play.cellRevealed(tray, index)
        else if (report === 'box') play.boxDone(tray)
        else if (report === 'down') sounds?.touched(tray)
        else if (report === 'up') sounds?.released(tray)
        else if (report === 'speed') sounds?.speed(tray, value)
    }

    let restore = -1
    const apply = (state: ScreenState) => {
        const enabled = play.traysEnabled
        view.trays.winning.enabled = enabled
        view.trays.yours.enabled = enabled
        view.trays.winning.lastBox = state.done.yours
        view.trays.yours.lastBox = state.done.winning
        view.trays.yours.waived = waivedValues(card, state.revealed)
        if (state.restore !== restore) {
            if (restore >= 0) {
                view.trays.winning.restore = state.restore
                view.trays.yours.restore = state.restore
            }
            restore = state.restore
        }
        // Her win state: the match lit, every other cell dark once a win is known.
        const lit = shownLit(state, card)
        const darken = darkensUnmatched(state)
        view.cells.winning.setLooks(lit.winning, darken)
        view.cells.yours.setLooks(lit.yours, darken)
        view.cells.winning.boxDone = state.done.winning
        view.cells.yours.boxDone = state.done.yours
        view.litAny = lit.winning.length + lit.yours.length > 0
        // His animations: the fields' sweep stops at the first stroke or Quick Scratch; the win's
        // glows are on from the moment a match lights until the card goes.
        if (cardPlayed(state)) view.animations?.played()
        const glowsOn = matchLit(lit) && !cardGone(state)
        if (view.backGlow) view.backGlow.lit = glowsOn
        view.cells.winning.glowsOn = !cardGone(state)
        view.cells.yours.glowsOn = !cardGone(state)
        if (state.phase === 'nowin') view.noWin?.show()
        const look = play.readsCollect ? 'collect' : 'quick'
        view.button.look = look
        view.button.offered = look === 'quick' ? play.quickOffered : state.collect === 'offered'
    }
    const quick = (tray: TrayName, token: number | null) => {
        view.trays[tray].quick = token
    }
    play.on('change', apply)
    play.on('quick', quick)
    view.button.onPress('quick', () => play.quick())
    view.button.onPress('collect', () => play.collect())
    apply(play.state)
    return () => {
        play.off('change', apply)
        play.off('quick', quick)
    }
}
