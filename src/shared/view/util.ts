import { PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { PlacedBox } from '../ported/runtime/layout/fit'

/** A sprite stretched over `box` (MiniGames' `Still` with `fit="fill"`). */
export function fill(sprite: PIXI.Sprite | PIXI.Container, box: PlacedBox | null | undefined): void {
    if (!box) {
        sprite.visible = false
        return
    }
    sprite.visible = true
    sprite.position.set(box.left, box.top)
    sprite.width = box.width
    sprite.height = box.height
}

/** A sprite anchored at its centre, stretched over `box`. */
export function fillCentred(sprite: PIXI.Sprite, box: PlacedBox | null | undefined): void {
    if (!box) {
        sprite.visible = false
        return
    }
    sprite.visible = true
    sprite.anchor.set(0.5)
    sprite.position.set(box.left + box.width / 2, box.top + box.height / 2)
    sprite.width = box.width
    sprite.height = box.height
}

/** A loaded texture by its URL (the asset's alias). */
export const texture = (url: string): PIXI.Texture => PIXI.Assets.get<PIXI.Texture>(url) ?? PIXI.Texture.EMPTY

export const hexColour = (hex: string): number => parseInt(hex.replace('#', ''), 16)
