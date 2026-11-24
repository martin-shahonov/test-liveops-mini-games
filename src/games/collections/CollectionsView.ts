import { Device, View } from '@betty-mini-games/test-liveops-sdk'

import { Collections } from './Collections'

/** Size the content is designed for; it is scaled down to fit smaller screens. */
const DESIGN_WIDTH = 680
const DESIGN_HEIGHT = 560

/** The game's only view. `render()` runs once the assets are loaded. */
export class CollectionsView extends View {
    protected _content?: Collections

    override render(): void {
        this._content = new Collections()
        this.addChild(this._content)

        this.layout()
        window.addEventListener('resize', this.layout)
    }

    override destroy(): void {
        window.removeEventListener('resize', this.layout)
        this._content?.destroy()

        super.destroy()
    }

    /** Centered, and scaled down when the screen is smaller than the design size. */
    protected layout = (): void => {
        this.position.set(Device.width / 2, Device.height / 2)
        this.scale.set(Math.min(1, Device.width / DESIGN_WIDTH, Device.height / DESIGN_HEIGHT))
    }
}
