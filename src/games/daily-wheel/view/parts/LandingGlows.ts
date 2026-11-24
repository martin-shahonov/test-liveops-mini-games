import { GameObject, gsap, PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { WheelSkin } from '../../skin/types'
import type { WheelSector } from '../../../../shared/ported/engine'
import { POINTER_ANGLE, sectorCentre } from '../../../../shared/ported/engine'
import type { PlannedLabel } from '../../ported/wheel/wheelLabels'
import { rimGlowBox } from '../../ported/wheel/discGeometry'
import { sectorGlowArea, sectorGlowFit } from '../../ported/wheel/glowArt'
import type { WheelLayout } from '../layout'
import { fill, texture } from '../../../../shared/view/util'
import { BitmapLine } from '../../../../shared/view/BitmapLine'
import { Glow } from '../../../../shared/view/Glow'

/** MiniGames' `Landing`: the sector landed on, the disc's turn at rest, and an id a new landing plays the intros again for. */
export type Landing = { index: number; turn: number; id: string }

/**
 * MiniGames' `LandingRim` and `LandingGlows`: at a landing, the rim's glow and the landed
 * sector's, drawn off the disc, over the title and Spin and under the win screen's dim,
 * with the landed amount and the pointer drawn again on top of them (the disc hides its
 * own meanwhile: `Disc.raised`). The sector's glow is kept to the face between the rim's
 * metal and the gem. They go out with the win (`level`).
 */
export class LandingGlows extends GameObject {
    protected _rimGlow?: Glow
    protected _sectorGlow?: Glow
    protected _faceMask = new PIXI.Graphics()
    /** Turned with the disc at rest, the landed amount on it. */
    protected _labels = new PIXI.Container()
    protected _label?: BitmapLine
    protected _pointer = new PIXI.Sprite()
    protected _landing: Landing | null = null
    protected _rim?: { left: number; top: number; width: number }

    constructor(
        protected _skin: WheelSkin,
        protected _sectors: readonly WheelSector[],
        protected _plan: () => readonly PlannedLabel[],
    ) {
        super()
        const glows = _skin.glows
        if (glows) {
            this._rimGlow = new Glow([glows.rim.intro, glows.rim.idle], { loop: true })
            this._sectorGlow = new Glow([glows.sector.intro, glows.sector.idle], { loop: true })
            this._sectorGlow.mask = this._faceMask
            this.addChild(this._rimGlow, this._sectorGlow, this._faceMask)
        }
        this._pointer.texture = texture(_skin.sources.pointer)
        this.addChild(this._labels, this._pointer)
        this.visible = false
    }

    get landing(): Landing | null {
        return this._landing
    }

    /** Lights a landing (its glows fade in at once, as MiniGames' win `glow` level is set to 1), or none. */
    set landing(landing: Landing | null) {
        this._landing = landing
        if (!landing) {
            this.visible = false
            this._rimGlow?.stop()
            this._sectorGlow?.stop()
            return
        }
        gsap.killTweensOf(this)
        this.visible = true
        this.alpha = 1
        for (const glow of [this._rimGlow, this._sectorGlow]) {
            if (!glow) continue
            glow.alpha = 1
            glow.play(landing.id)
        }
        this.placeLanding()
    }

    /** MiniGames' `useWinFade`'s `glow` going out: over `ms`, then the glows stop. */
    goOut(ms: number): Promise<void> {
        if (!this._landing) return Promise.resolve()
        return new Promise((resolve) => {
            gsap.to(this, {
                alpha: 0,
                duration: ms / 1000,
                overwrite: true,
                onComplete: () => {
                    this.landing = null
                    resolve()
                },
            })
        })
    }

    layout({ boxes }: WheelLayout): void {
        const { rim, gem, pointer } = boxes
        fill(this._pointer, pointer)
        const glows = this._skin.glows
        if (!rim) return
        this._rim = rim
        const rimSize = rim.width

        if (glows && this._rimGlow && this._sectorGlow) {
            const at = rimGlowBox(rimSize, glows.rim.size, glows.rim.centre, {
                width: glows.rim.intro.sourceWidth,
                height: glows.rim.intro.sourceHeight,
            })
            this._rimGlow.place({ tile: { x: rim.left + at.left, y: rim.top + at.top, width: at.width, height: at.height } })

            const area = sectorGlowArea(rimSize, glows.sector)
            const fit = sectorGlowFit(this._sectors.length, this._skin.sectors, glows.sector.edges)
            this._sectorGlow.place({
                tile: { ...area.tile, x: rim.left + area.tile.x, y: rim.top + area.tile.y },
                pivot: { x: rim.left + area.pivot.x, y: rim.top + area.pivot.y },
                stretchX: fit.stretch,
            })

            // `faceBetween`: the face inside the rim's metal, the gem's circle a hole in it.
            const cx = rim.left + rimSize / 2
            const cy = rim.top + rimSize / 2
            this._faceMask.clear().circle(cx, cy, rimSize * this._skin.rim.inner).fill(0xffffff)
            if (gem) {
                const g = this._skin.gem
                this._faceMask
                    .circle(gem.left + g.centre[0] * gem.width, gem.top + g.centre[1] * gem.width, g.radius * gem.width)
                    .cut()
            }
        }

        this._labels.position.set(rim.left + rimSize / 2, rim.top + rimSize / 2)
        this._labels.pivot.set(rimSize / 2, rimSize / 2)
        this.placeLanding()
    }

    /** The sector glow turned onto the landed sector, the disc's turn at rest added; the amount copied over it. */
    protected placeLanding(): void {
        const landing = this._landing
        const rim = this._rim
        if (!landing || !rim) return
        const glows = this._skin.glows
        if (glows && this._sectorGlow) {
            const fit = sectorGlowFit(this._sectors.length, this._skin.sectors, glows.sector.edges)
            this._sectorGlow.rotate =
                sectorCentre(landing.index, this._sectors.length) - POINTER_ANGLE + landing.turn + fit.turn
        }

        this._labels.rotation = landing.turn
        this._label?.parent?.destroy({ children: true })
        this._label = undefined
        const label = this._plan()[landing.index]
        if (!label) return
        const track = new PIXI.Container()
        track.position.set(rim.width / 2, rim.width / 2)
        track.rotation = label.angle
        const line = new BitmapLine(label.text, label.font, label.size)
        line.position.set(rim.width / 2 - label.inset - line.lineWidth, -line.lineHeight / 2)
        track.addChild(line)
        this._labels.addChild(track)
        this._label = line
    }
}
