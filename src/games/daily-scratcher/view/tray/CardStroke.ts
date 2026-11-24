import { PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { PlacedBox } from '../../../../shared/ported/runtime'
import {
    STROKE_MARGIN,
    initStroke,
    strokeBoxOf,
    strokeDown,
    strokeEnded,
    strokeLayoutOf,
    strokeMoved,
    strokeUp,
    type StrokeLayout,
    type StrokeState,
    type TrayLane,
} from '../../ported/tray/stroke'
import type { Tell, TrayShared } from '../../ported/tray/trayMotion'

/**
 * MiniGames' `ScratchStroke`: the card's one stroke over both trays, the gap between them
 * and a margin round them, so a finger scratches the whole card without lifting. Each
 * pointer is routed to the tray under it by the ported `stroke.ts`, as the gesture
 * handler's worklets route touches there.
 */
export class CardStroke extends PIXI.Container {
    protected _state: { value: StrokeState | null } = { value: null }
    protected _layout?: StrokeLayout
    protected _box?: PlacedBox
    protected _lanes: TrayShared[]
    protected _tells: Tell[]

    constructor(lanes: readonly TrayLane[]) {
        super()
        this._lanes = lanes.map((lane) => lane.shared)
        this._tells = lanes.map((lane) => lane.tell)
        initStroke(this._state as never, lanes.length)
        this.eventMode = 'static'
        this.on('pointerdown', this.down, this)
        this.on('globalpointermove', this.moved, this)
        this.on('pointerup', this.up, this)
        this.on('pointerupoutside', this.up, this)
        this.on('pointercancel', this.up, this)
    }

    /** Lays the stroke over `trays` (frame points), grown by the margin, at board scale `k`. */
    layout(trays: readonly PlacedBox[], k: number): void {
        const box = strokeBoxOf(trays, k, STROKE_MARGIN)
        this._box = box
        this._layout = strokeLayoutOf(box, trays, k, window.innerWidth, 0)
        this.hitArea = new PIXI.Rectangle(box.left, box.top, box.width, box.height)
    }

    protected point(event: PIXI.FederatedPointerEvent): { x: number; y: number } {
        const local = this.toLocal(event.global)
        return { x: local.x - this._box!.left, y: local.y - this._box!.top }
    }

    protected down(event: PIXI.FederatedPointerEvent): void {
        if (!this._layout) return
        const { x, y } = this.point(event)
        strokeDown(this._state as never, this._layout, this._lanes, this._tells, event.pointerId, x, y, event.global.x)
    }

    protected moved(event: PIXI.FederatedPointerEvent): void {
        if (!this._layout) return
        const { x, y } = this.point(event)
        strokeMoved(this._state as never, this._layout, this._lanes, this._tells, event.pointerId, x, y)
    }

    protected up(event: PIXI.FederatedPointerEvent): void {
        strokeUp(this._state as never, this._lanes, this._tells, event.pointerId)
    }

    /** Every finger still on the card lifts (the gesture's `onFinalize`). */
    endAll(): void {
        strokeEnded(this._state as never, this._lanes, this._tells)
    }
}
