import { PIXI, View, ViewConfig, type ViewAssets } from '@betty-mini-games/test-liveops-sdk'

import type { ScratcherSkin } from '../ported/skins'
import type { ScratcherCard } from '../ported/rules'
import { cardLayout, cardZones, fieldCore, type CardLayout, type SymbolInk } from '../ported/cardLayout'
import { trayCellArt, type CellArt, type TileArt } from '../ported/cardCells'
import { WINNING_REVEAL, YOURS_REVEAL } from '../ported/rules/reveal'
import { COIN_MOTION, coinArtOf, coinOpenOf } from '../ported/tray/coinMotion'
import { FLAKES } from '../ported/tray/flakes'
import { flakePlanOf } from '../ported/tray/flakeAtlas'
import { deviceClass } from '../ported/tray/tuning'
import type { Tell } from '../ported/tray/trayMotion'
import { ScratchTray } from './tray/ScratchTray'
import { CardStroke } from './tray/CardStroke'
import { ScratchHand } from './tray/ScratchHand'
import { valueText } from '../ported/cellAmount'
import { inkLinePlace } from '../ported/valueLine'
import { isSymbolId } from '../ported/skins'
import { Backdrop } from '../../../shared/view/Backdrop'
import { TopRow } from '../../../shared/view/TopRow'
import { readSafeArea } from '../../../shared/view/boardLayout'
import { fill, texture } from '../../../shared/view/util'
import { layoutCard, type CardLayoutOnScreen } from './layout'
import { Cells, MATCH_GLOW } from './parts/Cells'
import { CardButton } from './parts/CardButton'
import { ValueText } from './parts/ValueText'
import { BackGlow, CardAnimations } from './parts/CardAnimations'
import { CardGlow } from './parts/CardGlow'
import { NoWin } from './parts/NoWin'
import { noWinPlate } from '../ported/placement'
import type { ScratcherPlacement } from '../ported/DailyScratcherScreen.types'
import { prefersReducedMotion } from '../../../shared/devParams'
import { WinScreen } from '../../../shared/view/WinScreen'

/** MiniGames' `BOARD_COLOUR`: under the backdrop, and the cover's colour. */
export const BOARD_COLOUR = 0x0a0506

export type TrayName = 'winning' | 'yours'
export const TRAYS: readonly TrayName[] = ['winning', 'yours']

export type CardLabels = { quickScratch: string; collect: string }

export class CardConfig extends ViewConfig {
    constructor(
        readonly skin: ScratcherSkin,
        readonly card: ScratcherCard,
        readonly base: string,
        readonly labels: CardLabels = { quickScratch: 'Quick Scratch', collect: 'Collect' },
        /** QA: draws the cells without their coatings. */
        readonly bare = false,
        /** Where the card came from: see `noWinPlate`. */
        readonly placement: ScratcherPlacement = 'daily',
    ) {
        super()
    }
}

/**
 * The card's screen, as MiniGames' `DailyScratcherScreen` composes it: the frame, the
 * backdrop, the card's shadow, face and title, each tray's cells under its coating, the
 * top prize on the plate, the button and the top row. Laid out again on every resize.
 */
export class CardView extends View<CardConfig> {
    readonly frameLayer = new PIXI.Container()
    protected _background = new PIXI.Graphics()
    protected _mask = new PIXI.Graphics()
    backdrop!: Backdrop
    protected _stills!: Record<'cardshadow' | 'card' | 'titlegame', PIXI.Sprite>
    cells!: Record<TrayName, Cells>
    trays!: Record<TrayName, ScratchTray>
    stroke!: CardStroke
    hand?: ScratchHand
    animations?: CardAnimations
    backGlow?: BackGlow
    cardGlow!: CardGlow
    noWin?: NoWin
    win!: WinScreen
    /** What each tray tells: set by the game before the card renders. */
    tells: Record<TrayName, Tell> = { winning: () => {}, yours: () => {} }
    topPrize?: ValueText
    button!: CardButton
    topRow!: TopRow
    /** The cells as `cardLayout` lays them: the trays, their grids and cells. */
    cardCells!: CardLayout
    protected _layout?: CardLayoutOnScreen
    safeArea = readSafeArea()
    /** The card's one pulse, every lit glow breathing with it after their fade in (MiniGames' `useMatchPulse`). */
    protected _pulse = { phase: 0 }
    protected _pulseFrom = -1

    /** A match is lit: the pulse runs. */
    set litAny(lit: boolean) {
        if (lit && this._pulseFrom < 0) this._pulseFrom = performance.now() + MATCH_GLOW.fadeMs
        if (!lit) this._pulseFrom = -1
    }

    protected pulseStep(): void {
        this._pulse.phase = this._pulseFrom < 0 ? 0 : Math.max(0, performance.now() - this._pulseFrom) / MATCH_GLOW.pulseMs % 1
    }

    constructor(config: CardConfig, assets: ViewAssets) {
        super(config, assets)
    }

    override destroy(options?: PIXI.DestroyOptions): void {
        PIXI.Ticker.shared.remove(this.pulseStep, this)
        super.destroy(options)
    }

    get layoutNow(): CardLayoutOnScreen | undefined {
        return this._layout
    }

    override render(): void {
        const { skin, card, base, labels } = this._store
        this.backdrop = new Backdrop({})
        const still = (source: string) => new PIXI.Sprite(texture(source))
        this._stills = {
            cardshadow: still(skin.sources.cardshadow),
            card: still(skin.sources.card),
            titlegame: still(skin.sources.titlegame),
        }

        // The cells, as `art/compose.mjs` lays them out, and what each tray draws on them.
        const layout = cardLayout(skin, card)
        this.cardCells = layout
        const matchScale = skin.matchGlows.symbol.scale
        const symbols = (ids: readonly string[]) => ids.map((id) => (isSymbolId(id) ? skin.symbolArt[id] : undefined))
        const full: TileArt = { ...skin.tiles.full, glow: skin.matchGlows.tile.full, width: skin.cells[9].size[0] }
        const narrow: TileArt = { ...skin.tiles.narrow, glow: skin.matchGlows.tile.narrow, width: skin.cells[12].size[0] }
        this.cells = {
            winning: new Cells(
                layout.winning.slots,
                [{ ...full, width: skin.cells.winning.size[0] }],
                trayCellArt({ grid: layout.winning.grid, cells: layout.winning.cells, symbols: symbols(card.winning), matchScale }),
                skin.matchGlows.tile.grow,
                fieldCore(skin.elements.traywinning, skin.coatings.winning.field),
                undefined,
                skin.animations?.tile,
            ),
            yours: new Cells(
                layout.yours.slots,
                [full, narrow],
                trayCellArt({
                    grid: layout.yours.grid,
                    cells: layout.yours.cells,
                    symbols: symbols(card.cells.map((cell) => cell.symbol)),
                    matchScale,
                    values: { texts: card.cells.map((cell) => valueText(cell.prize)), sheet: skin.valueLine.sheet },
                }),
                skin.matchGlows.tile.grow,
                fieldCore(skin.elements.trayyours, skin.coatings.yours.field),
                { font: skin.valueLine.sheet.font, glow: skin.valueLine.glow, dark: skin.valueLine.dark },
                skin.animations?.tile,
            ),
        }
        const reduce = prefersReducedMotion()
        for (const name of TRAYS) {
            this.cells[name].pulse = this._pulse
            this.cells[name].reduceMotion = reduce
        }
        PIXI.Ticker.shared.add(this.pulseStep, this)

        // Each tray's coating, scratched off by the finger (MiniGames' `ScratchTray`), and
        // where a finger reads each cell: its symbol's ink and each character of its value.
        const winningArt = this.cells.winning.art
        const yoursArt = this.cells.yours.art
        const yoursIds = card.cells.map((cell) => cell.symbol)
        const inkSize = (ids: readonly string[]) => ids.map((id) => (isSymbolId(id) ? skin.symbolArt[id].inkSize : undefined))
        const inkOf = (ids: readonly string[], arts: readonly CellArt[]): (SymbolInk | undefined)[] =>
            ids.map((id, i) => {
                const map = isSymbolId(id) ? skin.symbolArt[id].inkMap : undefined
                const image = arts[i]?.symbol?.box
                return map !== undefined && image !== undefined ? { image, map } : undefined
            })
        const zones = {
            winning: cardZones(layout.winning, inkSize(card.winning), undefined, inkOf(card.winning, winningArt)),
            yours: cardZones(
                layout.yours,
                inkSize(yoursIds),
                yoursArt.map((art) => (art.value === undefined ? undefined : { text: art.value.text, sheet: skin.valueLine.sheet, place: art.value.place })),
                inkOf(yoursIds, yoursArt),
            ),
        }
        const coinOpen = coinOpenOf(coinArtOf(skin.scratchCoin))
        const reduceMotion = reduce
        const flakePlan = flakePlanOf(FLAKES, deviceClass(), reduceMotion)
        const tray = (name: TrayName) =>
            new ScratchTray({
                cells: layout[name].local,
                zones: zones[name],
                reveal: name === 'winning' ? WINNING_REVEAL : YOURS_REVEAL,
                size: layout[name].tray.size,
                field: skin.coatings[name].field,
                cellRadius: skin.tiles.radius,
                coating: skin.coatings[name].source,
                grit: skin.grit,
                coinPlan: name === 'yours' ? coinOpen.resting : coinOpen.plan,
                flakePlan,
                reduceMotion,
                tell: (report, index, value) => this.tells[name](report, index, value),
            })
        this.trays = { winning: tray('winning'), yours: tray('yours') }
        this.stroke = new CardStroke([this.trays.winning.lane, this.trays.yours.lane])
        // The coin in the hand, over both trays and the plaque: not drawn at all under Reduce Motion.
        if (!reduceMotion) {
            this.hand = new ScratchHand([this.trays.winning, this.trays.yours], skin.scratchCoin, coinOpen, flakePlan)
        }
        if (this._store.bare) for (const name of TRAYS) this.trays[name].visible = false
        void COIN_MOTION

        // The top prize's value on the plate the card bakes, centred by its ink, its caps on hers.
        const prize = card.topPrize
        const text = prize ? valueText(prize) : ''
        if (text) {
            const line = skin.topPrizeValue
            this.topPrize = new ValueText(
                text,
                line.sheet.font,
                inkLinePlace(text, line.sheet, { centre: [line.centreX, line.baseline - line.cap / 2], cap: line.cap }),
            )
        }

        const animated = skin.animations ? (skin as ScratcherSkin & { animations: NonNullable<ScratcherSkin['animations']> }) : null
        if (animated) {
            this.animations = new CardAnimations(animated)
            this.backGlow = new BackGlow(animated)
        }

        // The win screen: the card lit from behind and the sparks off its plate, under its face;
        // the rest over everything but the top row.
        this.cardGlow = new CardGlow(skin)
        this.win = new WinScreen({ art: skin.winScreen, spec: skin, sparksOrigin: skin.card.plate.centre })
        this.win.under.addChildAt(this.cardGlow, 0)
        this.win.lit = [this.cardGlow]

        // A card with no match ends under her plate, where the skin asks for it.
        if (skin.noWinPlate) this.noWin = new NoWin(skin.sources[noWinPlate(this._store.placement)], skin.overlayDim, reduce)

        this.button = new CardButton(skin.ui, { quick: labels.quickScratch, collect: labels.collect }, skin.glows?.button)
        this.topRow = new TopRow(
            {
                soundOn: `${base}ui/hud/iconsoundon.webp`,
                soundOff: `${base}ui/hud/iconsoundoff.webp`,
                help: `${base}ui/hud/iconhelp.webp`,
                close: `${base}ui/hud/iconclose.webp`,
            },
            { sound: () => this.emit('sound'), help: () => this.emit('help'), close: () => this.emit('close') },
        )

        this.frameLayer.addChild(this._background, this.backdrop)
        if (this.backGlow) this.frameLayer.addChild(this.backGlow)
        this.frameLayer.addChild(this._stills.cardshadow, this.win.under, this._stills.card, this._stills.titlegame)
        for (const tray of TRAYS) this.frameLayer.addChild(this.cells[tray], this.trays[tray])
        this.frameLayer.addChild(this.stroke)
        if (this.topPrize) this.frameLayer.addChild(this.topPrize)
        if (this.animations) this.frameLayer.addChild(this.animations)
        if (this.hand) this.frameLayer.addChild(this.hand)
        if (this.noWin) this.frameLayer.addChild(this.noWin)
        this.frameLayer.addChild(this.button, this.win.over, this.topRow)
        this.frameLayer.mask = this._mask
        // QA: the card, for a test page to read.
        if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __card: CardView }).__card = this
        this.addChild(this.frameLayer, this._mask)
    }

    override resize(width: number, height: number): void {
        const { skin } = this._store
        const layout = layoutCard(skin, width, height, this.safeArea)
        this._layout = layout
        const { frame, fit, placed } = layout
        this.frameLayer.position.set(frame.left, frame.top)
        this._background.clear().roundRect(0, 0, frame.width, frame.height, frame.radius).fill(BOARD_COLOUR)
        this._mask.clear().roundRect(frame.left, frame.top, frame.width, frame.height, frame.radius).fill(0xffffff)

        this.backdrop.layout(layout)
        for (const name of ['cardshadow', 'card', 'titlegame'] as const) fill(this._stills[name], placed.stills[name][1])
        for (const tray of TRAYS) {
            this.cells[tray].layout(layout)
            this.trays[tray].layout(placed.trays[tray], fit.k)
        }
        this.topPrize?.layout(fit)
        this.animations?.layout(fit)
        this.cardGlow.layout(fit)
        this.noWin?.layout(
            this.cardCells.yours.cells.map((cell) => layout.onScreen(cell)),
            skin.tiles.radius * fit.k,
            placed.noWin[noWinPlate(this._store.placement)][1],
            frame,
            fit.k,
        )
        this.win.layout(layout)
        this.backGlow?.layout(fit)
        this.stroke.layout([placed.trays.winning, placed.trays.yours], fit.k)
        this.hand?.layout([placed.trays.winning, placed.trays.yours], fit.k)
        this.button.place(placed.button)
        this.topRow.layout(layout)
        this.emit('layout', layout)
    }
}
