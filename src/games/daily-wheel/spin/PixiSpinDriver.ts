import { PIXI } from '@betty-mini-games/test-liveops-sdk'

import { THROW_MS, type SpinLaunch } from '../../../shared/ported/engine'
import type { FlickRelease, SpinDriver } from '../ported/wheel/spinController'
import { angleAt, restsAt, settles, settling, stopping, throwCurve, type SpinCurve } from '../ported/wheel/spinCurve'

type Orders = { spin: number; resting: number | null; stop: boolean }

/**
 * MiniGames' `reanimatedDriver` and its `turn` worklet, on Pixi's ticker: each spin's
 * curve (throw, cruise, settle or stop) sampled every frame into the wheel's rotation.
 * The orders (`settle`, `stop`) are read on the next frame, as the worklet reads them.
 */
export class PixiSpinDriver implements SpinDriver {
    protected _orders: Orders = { spin: 0, resting: null, stop: false }
    protected _settled?: () => void

    constructor(
        protected _read: () => number,
        protected _write: (rotation: number) => void,
        protected _ticker: PIXI.Ticker = PIXI.Ticker.shared,
    ) {}

    launch(start: SpinLaunch, release?: FlickRelease): Promise<void> {
        const spin = this._orders.spin + 1
        this._orders = { spin, resting: null, stop: false }
        this._settled = undefined
        const landing: { settled?: () => void } = {}
        this._landing = landing

        return new Promise<void>((thrown) => {
            let curve: SpinCurve | null = null
            let startedAt = 0
            let last = 0
            let toldThrown = false
            const tellThrown = () => {
                if (toldThrown) return
                toldThrown = true
                thrown()
            }
            const frame = () => {
                const asked = this._orders
                if (asked.spin !== spin) {
                    this._ticker.remove(frame)
                    tellThrown()
                    return
                }
                const now = performance.now()
                if (curve === null) {
                    if (start === 'flick' && release) {
                        curve = throwCurve(release.from, 'flick', release.speed)
                        startedAt = release.at
                    } else {
                        curve = throwCurve(this._read(), start, release?.speed ?? 0)
                        startedAt = now
                    }
                }
                const t = Math.max(last, now - startedAt)
                last = t
                if (asked.stop) {
                    curve = stopping(curve, t)
                } else if (asked.resting !== null) {
                    curve = settling(curve, t, asked.resting)
                }
                this._write(angleAt(curve, t))
                if (t >= THROW_MS[curve.start] || t >= curve.stopAt) tellThrown()
                if (t >= restsAt(curve)) {
                    this._ticker.remove(frame)
                    if (settles(curve)) landing.settled?.()
                }
            }
            this._ticker.add(frame)
        })
    }

    protected _landing: { settled?: () => void } = {}

    settle(resting: number, onSettled: () => void): void {
        this._landing.settled = onSettled
        this._orders = { ...this._orders, resting }
    }

    stop(): void {
        this._orders = { ...this._orders, stop: true }
    }

    /** Ends whatever spin is under way (the screen is going). */
    end(): void {
        this._orders = { spin: this._orders.spin + 1, resting: null, stop: false }
    }
}
