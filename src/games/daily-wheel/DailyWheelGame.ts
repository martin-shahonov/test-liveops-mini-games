import { DI, Game, sound, ViewAssets, type GameConfig } from '@betty-mini-games/test-liveops-sdk'
import { startsMuted } from '../../shared/devParams'

import { boardAssets } from './assets'
import { MockWheelBackend, type MockOptions, type WheelBackend } from './backend/mockBackend'
import { SpinSession } from './spin/SpinSession'
import { WheelDrag } from './spin/WheelDrag'
import { DailyWheelStartingState } from './states/StartingState'
import { DailyWheelResolvingState } from './states/ResolvingState'
import { DailyWheelPresentingState } from './states/PresentingState'
import { DailyWheelCompleteState } from './states/CompleteState'
import { DailyWheelModel } from './DailyWheelModel'
import type { WheelSector } from '../../shared/ported/engine'
import { loadSkin, type LoadedSkin } from './skin/loadSkin'
import { DailyWheelIdleState } from './states/IdleState'
import { DailyWheelInitState } from './states/InitState'
import { DailyWheelReadyState } from './states/ReadyState'
import { BoardConfig, BoardView } from './view/BoardView'
import { loadFonts } from '../../shared/view/fonts'
import { WheelSounds } from './sound/WheelSounds'
import { MOTION } from './ported/wheel/soundCues'

export type DailyWheelOptions = {
    /** The daily wheel's assets folder, ending in `/`. */
    base: string
    /** The player's tier, spelt as the host's status is (`Ruby`, `Vip`...). No tier, or one with no art: Member. */
    loyaltyTier?: string
    /** The prizes, in wheel order. The backend's when left out. */
    sectors?: readonly WheelSector[]
    /** Where the rewards come from. The mock, playing `scenario`, when left out. */
    backend?: WheelBackend
    /** What the mock awards and how it answers (the dev page's presets). */
    mock?: MockOptions
    /** Logs what the wheel decides (a drag's release, a spin's landing). */
    debug?: boolean
    /** Where the canvas goes and what it is sized to: the page's body and window when left out. */
    container?: HTMLElement
    /**
     * Run by a host (the daily games frame): called when the player is done (after one spin and its win screen) or presses
     * the close button. Left out on the dev page, where the game carries on.
     */
    onClose?: () => void
}

/** This game's state actions, model and controller in the SDK's DI. */
class DailyWheelDI extends DI {
    constructor(
        config: GameConfig,
        protected _loaded: LoadedSkin,
        protected _sectors: readonly WheelSector[],
        protected _backend: WheelBackend,
    ) {
        super(config)
    }

    protected override registerModel(): void {
        this._bottle.factory('model', () => {
            const model = new DailyWheelModel()
            model.skin = this._loaded.skin
            model.tierName = this._loaded.tierName
            model.sectors = this._sectors
            model.backend = this._backend
            // The wheel's turn goes to the board once it is drawn (see DailyWheelGame.start).
            model.sounds = new WheelSounds(this._loaded.skin, () => model.sectors.length)
            model.session = new SpinSession(this._backend, (rotation) => this._turn?.(rotation))
            return model
        })
    }

    get model(): DailyWheelModel {
        return this._bottle.container.model as DailyWheelModel
    }

    /** Set once the board exists: where the spin's rotation is drawn. */
    _turn?: (rotation: number) => void

    protected override registerStateActionsCtors(): void {
        super.registerStateActionsCtors()
        this._bottle.value('idleStateActionCtor', DailyWheelIdleState)
        this._bottle.value('initStateActionCtor', DailyWheelInitState)
        this._bottle.value('readyStateActionCtor', DailyWheelReadyState)
        this._bottle.value('startingStateActionCtor', DailyWheelStartingState)
        this._bottle.value('resolvingStateActionCtor', DailyWheelResolvingState)
        this._bottle.value('presentingStateActionCtor', DailyWheelPresentingState)
        this._bottle.value('completeStateActionCtor', DailyWheelCompleteState)
    }
}

/**
 * The Daily Wheel. `start()` first reads the tier's skin (its layout and files), then
 * loads only that tier's art, then draws the board.
 */
export class DailyWheelGame extends Game {
    constructor(protected _options: DailyWheelOptions) {
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
        const { base, loyaltyTier } = this._options
        const backend = this._options.backend ?? new MockWheelBackend(this._options.mock)
        const [loaded, sectors] = await Promise.all([
            loadSkin(base, loyaltyTier),
            this._options.sectors ?? backend.sectors(),
            loadFonts(base),
        ])
        const assets = new ViewAssets('daily-wheel', boardAssets(loaded.skin, base))
        this._config = {
            ...this._config,
            views: [{ name: 'board', view: BoardView, assets, config: new BoardConfig(loaded.skin, sectors, base) }],
        }
        const di = new DailyWheelDI(this._config, loaded, sectors, backend)
        this._di = di
        await super.load(onProgress)
        const board = this._views[0] as BoardView
        const model = di.model
        this._sounds = model.sounds
        const { onClose } = this._options
        model.onClose = onClose
        if (onClose) board.on('close', onClose)
        di._turn = (rotation) => {
            board.disc.turn = rotation
            // A turn the spin did not make is a hand's: a finger on the disc, or the ease after it.
            model.sounds.motion(rotation, model.session.spinning ? MOTION.spin : MOTION.hand)
        }
        // A host that kept the player's choice starts the game muted (`?muted=1` presets it).
        if (startsMuted()) {
            model.muted = true
            sound.muteAll()
            board.topRow.muted = true
        }
        board.on('sound', () => {
            model.muted = model.sounds.toggleMuted()
            board.topRow.muted = model.muted
        })
        // The title's glints, while the wheel waits for a spin.
        board.title.onGlowLoop = () => {
            if (model.flick !== undefined) model.sounds.shimmer()
        }
        board.attachDrag(
            new WheelDrag({
                read: () => model.session.rotation,
                write: (rotation) => model.session.setRotation(rotation),
                sectorCount: () => model.sectors.length,
                grabbable: () => model.flick !== undefined && !model.session.spinning,
                onFlick: (release) => model.flick?.(release) ?? false,
                onRelease: (readout) => {
                    if (this._options.debug) console.info('[daily-wheel] drag released', JSON.stringify(readout))
                },
            }),
        )
    }
}

