import type { SpinLaunch, WheelSector } from '../../../shared/ported/engine'
import { createSpinController, type FlickRelease, type SpinController, type SpinLanding } from '../ported/wheel/spinController'
import type { WheelBackend } from '../backend/mockBackend'
import { PixiSpinDriver } from './PixiSpinDriver'

/** One spin as the state actions follow it. */
export type SpinRun = {
    /** The claim answered and the wheel knows where it lands: the settle is under way. */
    landed: Promise<SpinLanding>
    /** The wheel is at rest on the landing's sector. */
    settled: Promise<SpinLanding>
    /** The claim failed: the wheel slows to rest on no particular prize. */
    failed: Promise<unknown>
}

/**
 * MiniGames' `useWheelSpin`: the spin controller (`ported/wheel/spinController.ts`,
 * unchanged) over a driver that turns the wheel on Pixi's ticker. The state actions
 * start a spin and wait on its stages.
 */
export class SpinSession {
    readonly driver: PixiSpinDriver
    protected _controller: SpinController
    protected _rotation = 0
    spinning = false

    constructor(
        protected _backend: WheelBackend,
        protected _turn: (rotation: number) => void,
    ) {
        this.driver = new PixiSpinDriver(
            () => this._rotation,
            (rotation) => {
                this._rotation = rotation
                this._turn(rotation)
            },
        )
        this._controller = createSpinController(
            this.driver,
            (spinning) => (this.spinning = spinning),
            () => {},
        )
    }

    get rotation(): number {
        return this._rotation
    }

    /** The hand turns the wheel between spins. */
    setRotation(rotation: number): void {
        this._rotation = rotation
        this._turn(rotation)
    }

    set backend(backend: WheelBackend) {
        this._backend = backend
    }

    /** Whether the host offers a spin (MiniGames' `spinAvailable`). */
    setOffered(offered: boolean): void {
        this._controller.setOffered(offered)
    }

    /** The screen is going: a spin under way hands its reward back at once. */
    close(): void {
        this._controller.setLive(false)
        this.driver.end()
    }

    spin(sectors: readonly WheelSector[], start: SpinLaunch = 'instant', release?: FlickRelease): SpinRun {
        let landed!: (landing: SpinLanding) => void
        let settled!: (landing: SpinLanding) => void
        let failed!: (error: unknown) => void
        const run: SpinRun = {
            landed: new Promise((resolve) => (landed = resolve)),
            settled: new Promise((resolve) => (settled = resolve)),
            failed: new Promise((resolve) => (failed = resolve)),
        }
        void this._controller.spin({
            sectors,
            start,
            release,
            getReward: () => this._backend.getReward(),
            onLanding: landed,
            onWin: settled,
            onError: failed,
            onRefused: () => failed(new Error('refused')),
        })
        return run
    }
}
