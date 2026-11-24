import { DI, Game, ViewAssets, type GameConfig } from '@betty-mini-games/test-liveops-sdk'

import { cardAssets } from './assets'
import { MockScratcherBackend, type MockOptions, type ScratcherBackend } from './backend/mockBackend'
import type { ScratcherPlacement } from './ported/DailyScratcherScreen.types'
import { DailyScratcherModel } from './DailyScratcherModel'
import type { ScratcherCard } from './ported/rules'
import type { ScratcherSkin } from './ported/skins'
import { loadSkin } from './skin/loadSkin'
import { DailyScratcherIdleState } from './states/IdleState'
import { DailyScratcherInitState } from './states/InitState'
import { DailyScratcherReadyState } from './states/ReadyState'
import { DailyScratcherStartingState } from './states/StartingState'
import { DailyScratcherResolvingState } from './states/ResolvingState'
import { DailyScratcherPresentingState } from './states/PresentingState'
import { DailyScratcherCompleteState } from './states/CompleteState'
import { DailyScratcherCompletedState } from './states/CompletedState'
import { CardConfig, CardView } from './view/CardView'
import { loadFonts } from '../../shared/view/fonts'
import { CardPlay } from './play/CardPlay'
import { ScratcherSounds } from './sound/ScratcherSounds'
import { quickPass } from './ported/quickScratch'
import { cardLayout } from './ported/cardLayout'
import { diagonalOf } from './ported/tray/diagonal'
import { SYMBOL_IDS } from './ported/skins'

export type DailyScratcherOptions = {
    /** The daily scratcher's assets folder, ending in `/`. */
    base: string
    /** The skin the card is drawn with: `generic` for none, or one with no art. */
    skin?: string
    /** The card from the host's launch. The backend's when left out. */
    card?: ScratcherCard
    /** Where the card and its reward come from. The mock, playing `scenario`, when left out. */
    backend?: ScratcherBackend
    /** What the mock deals and how it answers (the dev page's presets). */
    mock?: MockOptions
    /** Where the card came from: a daily card's no-win plate says come back tomorrow. */
    placement?: ScratcherPlacement
    debug?: boolean
    /** QA: the cells drawn without their coatings. */
    bare?: boolean
    /** Where the canvas goes and what it is sized to: the page's body and window when left out. */
    container?: HTMLElement
    /**
     * Run by a host (the daily games frame): called when the player is done (COLLECT) or presses
     * the close button. Left out on the dev page, where the game carries on.
     */
    onClose?: () => void
}

/** This game's state actions and model in the SDK's DI. */
class DailyScratcherDI extends DI {
    constructor(
        config: GameConfig,
        protected _skin: ScratcherSkin,
        protected _card: ScratcherCard,
        protected _backend: ScratcherBackend,
    ) {
        super(config)
    }

    protected override registerModel(): void {
        this._bottle.factory('model', () => {
            const model = new DailyScratcherModel()
            model.skin = this._skin
            model.card = this._card
            model.backend = this._backend
            // Quick Scratch's pass over both trays, a band over each: see `quickPass`.
            const layout = cardLayout(this._skin, this._card)
            const sweep = quickPass(
                { cells: layout.winning.local, diagonal: diagonalOf(...layout.winning.tray.size) },
                { cells: layout.yours.local, diagonal: diagonalOf(...layout.yours.tray.size) },
                true,
            )
            model.sounds = new ScratcherSounds(this._skin)
            model.play = new CardPlay(this._card, SYMBOL_IDS, () => this._backend.claim(this._card), sweep, model.sounds)
            return model
        })
    }

    get model(): DailyScratcherModel {
        return this._bottle.container.model as DailyScratcherModel
    }

    protected override registerStateActionsCtors(): void {
        super.registerStateActionsCtors()
        this._bottle.value('idleStateActionCtor', DailyScratcherIdleState)
        this._bottle.value('initStateActionCtor', DailyScratcherInitState)
        this._bottle.value('readyStateActionCtor', DailyScratcherReadyState)
        this._bottle.value('startingStateActionCtor', DailyScratcherStartingState)
        this._bottle.value('resolvingStateActionCtor', DailyScratcherResolvingState)
        this._bottle.value('presentingStateActionCtor', DailyScratcherPresentingState)
        this._bottle.value('completeStateActionCtor', DailyScratcherCompleteState)
        this._bottle.value('completedStateActionCtor', DailyScratcherCompletedState)
    }
}

/**
 * The Daily Scratcher. `start()` first reads the skin and the card, then loads the art
 * the card draws, then draws it.
 */
export class DailyScratcherGame extends Game {
    constructor(protected _options: DailyScratcherOptions) {
        const { container } = _options
        super({ views: [], container, app: { backgroundAlpha: 0, antialias: true, ...(container ? { resizeTo: container } : {}) } })
    }

    protected _sounds?: { destroy(): void }

    /** Its sounds go with it: the page's audio outlives the game, and a loop left playing would stack under the next open. */
    protected override teardown(): void {
        this._sounds?.destroy()
        super.teardown()
    }

    protected override async load(onProgress?: (progress: number) => void): Promise<void> {
        const { base } = this._options
        const backend = this._options.backend ?? new MockScratcherBackend(this._options.mock)
        const [skin, card] = await Promise.all([
            loadSkin(base, this._options.skin),
            this._options.card ?? backend.card(),
            loadFonts(base),
        ])
        const assets = new ViewAssets('daily-scratcher', cardAssets(skin, card, base))
        this._config = {
            ...this._config,
            views: [{ name: 'card', view: CardView, assets, config: new CardConfig(skin, card, base, undefined, this._options.bare, this._options.placement ?? 'daily') }],
        }
        const di = new DailyScratcherDI(this._config, skin, card, backend)
        this._di = di
        await super.load(onProgress)
        const model = di.model
        this._sounds = model.sounds
        const { onClose } = this._options
        model.onClose = onClose
        if (onClose) (this._views[0] as CardView).on('close', onClose)
    }
}
