import { GameObject, PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { WheelSkin } from '../../skin/types'
import type { WheelSector } from '../../../../shared/ported/engine'
import type { WheelLayout } from '../layout'
import { fill, texture } from '../../../../shared/view/util'
import { planLabels, type PlannedLabel } from '../../ported/wheel/wheelLabels'
import type { DiscParts } from '../../ported/wheel/discGeometry'
import { BitmapLine } from '../../../../shared/view/BitmapLine'
import { Glow } from '../../../../shared/view/Glow'
import { POINTER_ANGLE, sectorCentre } from '../../../../shared/ported/engine'
import { sectorGlowArea, sectorGlowFit } from '../../ported/wheel/glowArt'

/** Which sector glows, and a new `id` plays its intro again. */
export type SectorGlowAt = { index: number; id: string }

/**
 * MiniGames' `WheelDisc`, bottom to top: the face's metal and light (it does not
 * turn, its light is painted from one side), the sectors (turning), the gem, the
 * rim, the amounts (turning, over the rim's inner shadow) and the pointer.
 */
export class Disc extends GameObject {
    protected _base = new PIXI.Sprite()
    /** Everything that turns under the gem and the rim, about the rim's centre. */
    readonly sectorsLayer = new PIXI.Container()
    protected _sectors = new PIXI.Sprite()
    protected _gem = new PIXI.Sprite()
    protected _rim = new PIXI.Sprite()
    /** The amounts, turning with the sectors over the rim. */
    readonly labelsLayer = new PIXI.Container()
    protected _labels: { label: PlannedLabel; line: BitmapLine; track: PIXI.Container }[] = []
    protected _pointer = new PIXI.Sprite()
    protected _turn = 0
    protected _raised: number | null = null
    protected _planKey = ''
    /** The resting wheel's sector glow: on the glowing sector, turning with the face, under the gem and the rim. */
    readonly sectorGlow?: Glow
    protected _glowAt: SectorGlowAt | null = null

    constructor(
        protected _skin: WheelSkin,
        protected _sectorsData: readonly WheelSector[],
    ) {
        super()
        const { sources } = _skin
        this._base.texture = texture(sources.facebase)
        this._sectors.texture = texture(sources.facesectors)
        this._gem.texture = texture(sources.gem)
        this._rim.texture = texture(sources.rim)
        this._pointer.texture = texture(sources.pointer)
        this.sectorsLayer.addChild(this._sectors)
        const glows = _skin.glows
        if (glows) {
            this.sectorGlow = new Glow([glows.sector.intro, glows.sector.idle], { loop: true })
            this.sectorsLayer.addChild(this.sectorGlow)
        }
        this.addChild(this._base, this.sectorsLayer, this._gem, this._rim, this.labelsLayer, this._pointer)
    }

    /** The wheel's turn in radians (MiniGames' `rotation` shared value). */
    get turn(): number {
        return this._turn
    }

    set turn(value: number) {
        this._turn = value
        this.sectorsLayer.rotation = value
        this.labelsLayer.rotation = value
    }

    /** The sector whose amount is lifted off the wheel by the landing's glow (hidden here), or none. */
    set raised(index: number | null) {
        this._raised = index
        this._labels.forEach(({ track }, i) => (track.visible = i !== index))
        this._pointer.visible = index === null
    }

    /**
     * The sector the resting glow lights, or none (MiniGames' `sectorGlow`): kept and
     * moved between sectors, its intro played again for a new id.
     */
    set glowAt(at: SectorGlowAt | null) {
        this._glowAt = at
        const glow = this.sectorGlow
        if (!glow) return
        if (!at) {
            glow.stop()
            return
        }
        glow.rotate = this.glowTurn(at.index)
        glow.play(at.id)
    }

    get glowAt(): SectorGlowAt | null {
        return this._glowAt
    }

    /** The export points at 12 o'clock; the face measures from 3. */
    protected glowTurn(index: number): number {
        const glows = this._skin.glows
        if (!glows) return 0
        const fit = sectorGlowFit(this._sectorsData.length, this._skin.sectors, glows.sector.edges)
        return sectorCentre(index, this._sectorsData.length) - POINTER_ANGLE + fit.turn
    }

    /** The amounts as planned for the rim's size, in the sectors' order. */
    get plannedLabels(): readonly PlannedLabel[] {
        return this._labels.map(({ label }) => label)
    }

    setSectors(sectors: readonly WheelSector[]): void {
        this._sectorsData = sectors
        this._planKey = ''
    }

    layout({ boxes }: WheelLayout): void {
        const { rim, facebase, facesectors, gem, pointer } = boxes
        fill(this._base, facebase)
        fill(this._gem, gem)
        fill(this._rim, rim)
        fill(this._pointer, pointer)
        if (!rim || !facesectors) return

        // The turning layers pivot on the rim's centre; their children are placed relative to the rim's box.
        const cx = rim.left + rim.width / 2
        const cy = rim.top + rim.height / 2
        for (const layer of [this.sectorsLayer, this.labelsLayer]) {
            layer.position.set(cx, cy)
            layer.pivot.set(rim.width / 2, rim.height / 2)
        }
        fill(this._sectors, {
            left: facesectors.left - rim.left,
            top: facesectors.top - rim.top,
            width: facesectors.width,
            height: facesectors.height,
        })

        const glows = this._skin.glows
        if (this.sectorGlow && glows) {
            const area = sectorGlowArea(rim.width, glows.sector)
            const fit = sectorGlowFit(this._sectorsData.length, this._skin.sectors, glows.sector.edges)
            this.sectorGlow.place({
                tile: area.tile,
                pivot: area.pivot,
                stretchX: fit.stretch,
                rotate: this._glowAt ? this.glowTurn(this._glowAt.index) : 0,
            })
        }

        const parts: DiscParts = {
            rimSize: rim.width,
            rimInner: this._skin.rim.inner,
            labelRadius: this._skin.labels.radius,
            faceSize: facesectors.width,
            gemSize: gem?.width ?? 0,
        }
        this.planLabels(parts)
    }

    /** `WheelLabel`: each amount right-aligned `inset` in from the rim's edge, on the sector's centre line. */
    protected planLabels(parts: DiscParts): void {
        const key = JSON.stringify([parts, this._sectorsData.map((s) => s.winAmount)])
        if (key === this._planKey) return
        this._planKey = key
        this._labels.forEach(({ track }) => track.destroy({ children: true }))
        this._labels = planLabels(this._sectorsData, this._skin, parts).map((label) => {
            const track = new PIXI.Container()
            // A square the rim's size, turned about its centre by the sector's angle.
            track.position.set(parts.rimSize / 2, parts.rimSize / 2)
            track.rotation = label.angle
            const line = new BitmapLine(label.text, label.font, label.size)
            line.position.set(parts.rimSize / 2 - label.inset - line.lineWidth, -line.lineHeight / 2)
            track.addChild(line)
            this.labelsLayer.addChild(track)
            return { label, line, track }
        })
        this.raised = this._raised
    }
}
