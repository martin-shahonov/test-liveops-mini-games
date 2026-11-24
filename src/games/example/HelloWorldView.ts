import { Device, View } from '@betty-mini-games/test-liveops-sdk'

import { HelloWorld } from './HelloWorld'

/** Size the content is designed for; it is scaled down to fit smaller screens (e.g. a phone). */
const DESIGN_WIDTH = 680
const DESIGN_HEIGHT = 560

/**
 * A view is a screen layer, added to the stage by the SDK.
 * `render()` runs once the assets are loaded, so build anything that uses assets there (not in `create()`).
 */
export class HelloWorldView extends View {
    protected _helloWorld?: HelloWorld

    override render(): void {
        this._helloWorld = new HelloWorld()
        this.addChild(this._helloWorld)

        this.layout()
        window.addEventListener('resize', this.layout)
    }

    override destroy(): void {
        window.removeEventListener('resize', this.layout)
        this._helloWorld?.destroy()

        super.destroy()
    }

    /** Centered, and scaled down when the screen is smaller than the design size. */
    protected layout = (): void => {
        this.position.set(Device.width / 2, Device.height / 2)
        this.scale.set(Math.min(1, Device.width / DESIGN_WIDTH, Device.height / DESIGN_HEIGHT))
    }
}
