import { PIXI, View, ViewConfig, type ViewAssets } from '@betty-mini-games/test-liveops-sdk'

import type { WheelSkin } from '../skin/types'
import type { WheelSector } from '../../../shared/ported/engine'
import { layoutWheel, type WheelLayout } from './layout'
import { readSafeArea } from '../../../shared/view/boardLayout'
import { Backdrop } from '../../../shared/view/Backdrop'
import { Floor } from './parts/Floor'
import { Sides } from './parts/Sides'
import { Disc } from './parts/Disc'
import { Title } from './parts/Title'
import { SpinButton } from './parts/SpinButton'
import { TopRow } from '../../../shared/view/TopRow'
import { LandingGlows } from './parts/LandingGlows'
import { WinScreen } from '../../../shared/view/WinScreen'
import type { SectorGlowAt } from './parts/Disc'
import { RESTING_GLOWS, type RestingGlow } from '../ported/wheel/glowArt'
import type { WheelDrag } from '../spin/WheelDrag'

/** MiniGames' `BOARD_COLOUR`: under the backdrop, and the cover's colour. */
export const BOARD_COLOUR = 0x0a0506

export class BoardConfig extends ViewConfig {
    constructor(
        readonly skin: WheelSkin,
        readonly sectors: readonly WheelSector[],
        readonly base: string,
        readonly labels: { spin: string } = { spin: 'Spin' },
    ) {
        super()
    }
}

/**
 * The wheel's board, as MiniGames' `DailyWheelScreen` composes it: the frame (the whole
 * canvas on a phone, a rounded popup on a desktop), the backdrop, the floor and sides,
 * the disc, the title, Spin and the top row. Laid out again on every resize.
 */
export class BoardView extends View<BoardConfig> {
    readonly frameLayer = new PIXI.Container()
    protected _background = new PIXI.Graphics()
    protected _mask = new PIXI.Graphics()
    backdrop!: Backdrop
    floor?: Floor
    sides?: Sides
    disc!: Disc
    title!: Title
    spin!: SpinButton
    topRow!: TopRow
    landingGlows!: LandingGlows
    win!: WinScreen
    protected _layout?: WheelLayout
    /** Which of the resting wheel's glows the open has lit (MiniGames' `glowsLit`). */
    readonly glowsLit: Record<RestingGlow, boolean> = { sector: false, title: false, button: false }
    protected _resting: SectorGlowAt | null = null

    constructor(config: BoardConfig, assets: ViewAssets) {
        super(config, assets)
    }

    protected _drag?: WheelDrag

    /** The disc's drag area, over the disc and under the title and Spin. */
    attachDrag(drag: WheelDrag): void {
        this._drag = drag
        this.frameLayer.addChildAt(drag.area, this.frameLayer.getChildIndex(this.disc) + 1)
        if (this._layout) drag.layout(this._layout.boxes.rim, this._layout.boxes.gem)
    }

    get layoutNow(): WheelLayout | undefined {
        return this._layout
    }

    override render(): void {
        const { skin, sectors, base, labels } = this._store
        this.backdrop = new Backdrop(skin)
        this.floor = skin.floor ? new Floor(skin.floor) : undefined
        this.sides = skin.sides ? new Sides(skin.sides) : undefined
        this.disc = new Disc(skin, sectors)
        this.title = new Title(skin)
        this.spin = new SpinButton(skin.ui, skin.spinColor, labels.spin, skin.glows)
        this.landingGlows = new LandingGlows(skin, sectors, () => this.disc.plannedLabels)
        this.win = new WinScreen({ art: skin.winScreen, spec: skin, sparksOrigin: skin.elements.rim.centre, glow: skin.winScreen.glow })
        this.win.lit = [this.landingGlows]
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
        if (this.floor) this.frameLayer.addChild(this.floor)
        if (this.sides) this.frameLayer.addChild(this.sides)
        // The win glow and the sparks behind the wheel; the rest of the win over all but the top row.
        this.frameLayer.addChild(this.win.under, this.disc, this.title, this.spin, this.landingGlows, this.win.over, this.topRow)
        this.frameLayer.mask = this._mask
        this.addChild(this.frameLayer, this._mask)
    }

    /**
     * The open's glows, as MiniGames' `useOpenSequence` lights them: the sector's, the
     * title's and Spin's, one after another (`RESTING_GLOWS`), each fading in over
     * `GLOW_FADE_MS` as it comes. Every sheet is loaded before the board shows, so each
     * waits only for the one before it to start.
     */
    lightGlows(stepMs = 100): Promise<void> {
        return new Promise((resolve) => {
            RESTING_GLOWS.forEach((glow, i) =>
                setTimeout(() => {
                    this.glowsLit[glow] = true
                    if (glow === 'sector') {
                        this.disc.sectorGlow?.fadeTo(1)
                        this.restingGlow = this._resting
                    } else if (glow === 'title') {
                        this.title.glow?.play()
                        this.title.glow?.fadeTo(1)
                    } else {
                        this.spin.glowLit = true
                    }
                    if (i === RESTING_GLOWS.length - 1) resolve()
                }, i * stepMs),
            )
        })
    }

    /**
     * The sector the resting wheel glows on (MiniGames' `idleGlow`): the top prize before a
     * spin, nothing while one runs or a win is shown. Drawn once the open has lit it.
     */
    set restingGlow(at: SectorGlowAt | null) {
        this._resting = at
        this.disc.glowAt = this.glowsLit.sector ? at : null
    }

    /** The window's insets the system covers (a notch, a home bar), when the frame fills it. */
    safeArea: { top?: number; left?: number; right?: number } = readSafeArea()

    override resize(width: number, height: number): void {
        const layout = layoutWheel(this._store.skin, width, height, this.safeArea)
        this._layout = layout
        const { frame } = layout
        this.frameLayer.position.set(frame.left, frame.top)
        this._background.clear().roundRect(0, 0, frame.width, frame.height, frame.radius).fill(BOARD_COLOUR)
        this._mask.clear().roundRect(frame.left, frame.top, frame.width, frame.height, frame.radius).fill(0xffffff)

        this.backdrop.layout(layout)
        this.floor?.layout(layout)
        this.sides?.layout(layout)
        this.disc.layout(layout)
        this.title.layout(layout)
        this.spin.layout(layout)
        this.topRow.layout(layout)
        this.landingGlows.layout(layout)
        this.win.layout(layout)
        this._drag?.layout(layout.boxes.rim, layout.boxes.gem)
        this.emit('layout', layout)
    }
}
