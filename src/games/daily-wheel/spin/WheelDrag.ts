import { PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { FlickRelease } from '../ported/wheel/spinController'
import { angleAt, throwCurve, turningAt, type SpinCurve } from '../ported/wheel/spinCurve'
import {
    DRAG_RING,
    clearOfHub,
    easeAngleAt,
    easeToRest,
    fingerAt,
    followFinger,
    leaveSpeed,
    releaseOf,
    releaseVerdict,
    runFrom,
    runTravel,
    stoppedAt,
    takesTouch,
    traceWith,
    trackRun,
    trailSpeed,
    trailWith,
    type DragReleaseReason,
    type Ease,
    type FingerAngle,
    type HandRelease,
    type MoveTrace,
    type Trail,
} from '../ported/wheel/wheelDrag'
import { followPointers, liftVelocity } from '../ported/wheel/liftVelocity'
import type { PlacedBox } from '../../../shared/ported/runtime/layout/fit'

type Hand = FingerAngle & { x: number; y: number; trace: MoveTrace; release: HandRelease | null }

export type DragReadout = { speed: number; fingerSpeed: number; spun: boolean; reason: DragReleaseReason }

export type WheelDragInput = {
    /** The wheel's rotation now, and where to draw it. */
    read: () => number
    write: (rotation: number) => void
    sectorCount: () => number
    /** Whether a grab may start: Spin is offered and no spin turns the wheel. */
    grabbable: () => boolean
    /** A release fast and far enough to throw a spin: true if the screen takes it as one. */
    onFlick: (release: FlickRelease) => boolean
    onRelease?: (readout: DragReadout) => void
}

/**
 * MiniGames' `WheelDragArea` with `carryHand` (dragMotion.ts): the disc follows the
 * finger round its centre; let go fast and far enough forward and it throws a spin
 * that carries on from the finger's speed (`FlickRelease`), otherwise it eases to rest
 * on a sector's centre. The rules (`wheelDrag.ts`, `pointerVelocity.ts`) are MiniGames'.
 */
export class WheelDrag {
    readonly area = new PIXI.Container()
    protected _box?: PlacedBox
    protected _hub = 0
    protected _hand?: Hand
    protected _loop?: (ticker: PIXI.Ticker) => void
    protected _stopPointers = followPointers()
    protected _token = 0

    constructor(protected _input: WheelDragInput) {
        this.area.eventMode = 'static'
        this.area.on('pointerdown', this.down, this)
        this.area.on('globalpointermove', this.move, this)
        this.area.on('pointerup', this.up, this)
        this.area.on('pointerupoutside', this.up, this)
    }

    /** Over the rim's box, the hub being `DRAG_RING.hubShare` of the gem's width. */
    layout(rim: PlacedBox | null, gem: PlacedBox | null): void {
        if (!rim) return
        this._box = rim
        this._hub = DRAG_RING.hubShare * (gem?.width ?? 0)
        this.area.hitArea = new PIXI.Circle(rim.left + rim.width / 2, rim.top + rim.height / 2, rim.width / 2)
    }

    destroy(): void {
        this.stopLoop()
        this._stopPointers()
        this.area.destroy()
    }

    protected centreOf(event: PIXI.FederatedPointerEvent): { dx: number; dy: number } {
        const box = this._box!
        const local = this.area.toLocal(event.global)
        return { dx: local.x - (box.left + box.width / 2), dy: local.y - (box.top + box.height / 2) }
    }

    protected down(event: PIXI.FederatedPointerEvent): void {
        if (!this._box || this._hand) return
        const { dx, dy } = this.centreOf(event)
        if (!takesTouch(this._input.grabbable(), false, dx, dy, this._hub, this._box.width / 2, event.global.x, window.innerWidth, 0)) {
            return
        }
        const finger = fingerAt(dx, dy)
        this._hand = { ...finger, x: dx, y: dy, trace: traceWith([], performance.now(), finger.angle), release: null }
        this.carry()
    }

    protected move(event: PIXI.FederatedPointerEvent): void {
        const hand = this._hand
        if (!hand || hand.release) return
        const { dx, dy } = this.centreOf(event)
        const finger = followFinger(hand, dx, dy, DRAG_RING.deadShare * this._hub)
        this._hand = { ...hand, ...finger, x: dx, y: dy, trace: traceWith(hand.trace, performance.now(), finger.angle) }
    }

    protected up(): void {
        const hand = this._hand
        if (!hand || hand.release || this._lifting) return
        // The lift's velocity is worked out by the window's own pointerup listener
        // (`followPointers`), which can run after Pixi's: read it once this event is through.
        this._lifting = true
        queueMicrotask(() => {
            this._lifting = false
            if (this._hand !== hand || hand.release) return
            const { vx, vy } = liftVelocity(0, 0)
            const out = Math.sqrt(hand.x * hand.x + hand.y * hand.y)
            const moving = clearOfHub(hand, out)
            hand.release = releaseOf(vx, vy, hand.x, hand.y, this._hub, true, moving)
        })
    }

    protected _lifting = false

    /** `carryHand`: one loop per grab, from the grab to the wheel's rest or its spin. */
    protected carry(): void {
        this.stopLoop()
        const token = ++this._token
        const fromRotation = this._input.read()
        const fromAngle = this._hand!.angle
        let previous = fromRotation
        let movedAt = -Infinity
        let lastFrameAt = -Infinity
        let trail: Trail = []
        let run = runFrom(fromRotation)
        let releasedAt = 0
        let ease: Ease | null = null
        let flick: SpinCurve | null = null

        const loop = () => {
            const now = performance.now()
            if (flick !== null) {
                // Refused by the screen after all: ease out of the throw.
                const t = Math.max(0, now - releasedAt)
                ease = easeToRest(angleAt(flick, t), turningAt(flick, t), this._input.sectorCount())
                flick = null
                releasedAt = now
            }
            if (ease !== null) {
                const t = now - releasedAt
                this._input.write(easeAngleAt(ease, t))
                if (t >= ease.ms) this.stopLoop()
                return
            }
            const hand = this._hand!
            const turned = fromRotation + (hand.angle - fromAngle)
            if (turned !== previous) {
                run = trackRun(run, turned)
                previous = turned
                movedAt = now
                this._input.write(turned)
            }
            trail = trailWith(trail, now, turned)
            const release = hand.release
            if (release === null) {
                lastFrameAt = now
                return
            }

            this._hand = undefined
            const speed = stoppedAt(release) ? 0 : release.turning
            const verdict = releaseVerdict(release.ok, speed, runTravel(run, turned))
            releasedAt = movedAt >= lastFrameAt ? movedAt : now
            const drawn = trailSpeed(trail, releasedAt) * 1000
            const t = now - releasedAt
            if (verdict.flick && this._input.grabbable()) {
                const leaves = leaveSpeed(drawn, verdict.speed) / 1000
                const curve = throwCurve(turned, 'flick', leaves)
                this._input.write(angleAt(curve, t))
                const taken = this._input.onFlick({ token, from: turned, at: releasedAt, speed: leaves })
                this._input.onRelease?.({ speed, fingerSpeed: release.fingerSpeed, spun: taken, reason: verdict.reason })
                if (taken) {
                    // The spin's driver carries on from this very curve.
                    this.stopLoop()
                } else {
                    flick = curve
                }
                return
            }
            const leaves = leaveSpeed(drawn, speed)
            ease = easeToRest(turned, leaves / 1000, this._input.sectorCount())
            this._input.write(easeAngleAt(ease, t))
            this._input.onRelease?.({
                speed,
                fingerSpeed: release.fingerSpeed,
                spun: false,
                reason: verdict.flick ? 'refused' : verdict.reason,
            })
        }
        this._loop = loop
        PIXI.Ticker.shared.add(loop)
    }

    protected stopLoop(): void {
        if (this._loop) {
            PIXI.Ticker.shared.remove(this._loop)
            this._loop = undefined
        }
    }
}
