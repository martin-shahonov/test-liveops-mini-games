import { GameObject, PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { HudPlaces } from '../ported/runtime/layout/topRow'
import { fillCentred, texture } from './util'
import type { PlacedBox } from '../ported/runtime/layout/fit'

export type TopRowIcons = { soundOn: string; soundOff: string; help: string; close: string }

type Name = 'sound' | 'help' | 'close'

/**
 * MiniGames' `HudRow`: sound, help and close, each icon in a 44 pt tap zone, placed by
 * the HUD's rule (`placeHud`), at the rule's opacity. The press scales the icon.
 */
export class TopRow extends GameObject {
    protected _icons: Record<Name | 'soundOff', PIXI.Sprite>
    protected _zones: Record<Name, PIXI.Container>
    protected _muted = false

    constructor(
        icons: TopRowIcons,
        protected _handlers: Record<Name, () => void>,
    ) {
        super()
        this._icons = {
            sound: new PIXI.Sprite(texture(icons.soundOn)),
            soundOff: new PIXI.Sprite(texture(icons.soundOff)),
            help: new PIXI.Sprite(texture(icons.help)),
            close: new PIXI.Sprite(texture(icons.close)),
        }
        this._zones = { sound: new PIXI.Container(), help: new PIXI.Container(), close: new PIXI.Container() }
        for (const name of ['sound', 'help', 'close'] as const) {
            const zone = this._zones[name]
            zone.eventMode = 'static'
            zone.cursor = 'pointer'
            zone.on('pointertap', () => this._handlers[name]())
            zone.on('pointerdown', () => (this.iconOf(name).scale.x *= 0.9, this.iconOf(name).scale.y *= 0.9))
            const release = () => this.relayoutIcon(name)
            zone.on('pointerup', release)
            zone.on('pointerupoutside', release)
            this.addChild(zone)
        }
        this.addChild(this._icons.sound, this._icons.soundOff, this._icons.help, this._icons.close)
        this.muted = false
    }

    set muted(value: boolean) {
        this._muted = value
        this._icons.sound.visible = !value
        this._icons.soundOff.visible = value
    }

    protected _boxes?: Record<Name | 'soundOff', PlacedBox>

    layout({ hud }: { hud: HudPlaces }): void {
        const { buttons, icons, opacity } = hud
        this._boxes = icons
        for (const name of ['sound', 'soundOff', 'help', 'close'] as const) {
            const sprite = this._icons[name]
            fillCentred(sprite, icons[name])
            sprite.alpha = opacity
        }
        this.muted = this._muted
        for (const name of ['sound', 'help', 'close'] as const) {
            const zone = buttons[name]
            this._zones[name].hitArea = new PIXI.Rectangle(zone.left, zone.top, zone.width, zone.height)
        }
    }

    protected iconOf(name: Name): PIXI.Sprite {
        return name === 'sound' && this._muted ? this._icons.soundOff : this._icons[name]
    }

    protected relayoutIcon(name: Name): void {
        if (!this._boxes) return
        if (name === 'sound') {
            fillCentred(this._icons.sound, this._boxes.sound)
            fillCentred(this._icons.soundOff, this._boxes.soundOff)
            this.muted = this._muted
        } else {
            fillCentred(this._icons[name], this._boxes[name])
        }
    }
}
