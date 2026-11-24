import type { WheelSkin } from '../skin/types'
import { place, placeBox, type PlacedBox } from '../../../shared/ported/runtime/layout/fit'
import type { TopRowInsets } from '../../../shared/ported/runtime/layout/topRow'
import { placeInComposition } from '../ported/wheel/floorPlacement'
import { placeBackdropSides, type SidesPlacement } from '../ported/wheel/sidePlacement'
import { boardLayout, type BoardLayout } from '../../../shared/view/boardLayout'

/**
 * Where everything goes for one canvas size: MiniGames' `Board`, `DailyWheelScreen` and
 * `TopRowSlot` layout, worked out by the same functions (see `ported/`).
 *
 * All boxes are in CSS pixels, relative to the game frame's top left corner.
 */
export type WheelLayout = BoardLayout & {
    /** The floor's cut drawn over the backdrop, its rows placed in the composition. */
    floor?: { cut: 'portrait' | 'square'; place: (rect: { x: number; y: number; w: number; h: number }) => PlacedBox }
    sides?: SidesPlacement
    boxes: {
        rim: PlacedBox | null
        facebase: PlacedBox | null
        facesectors: PlacedBox | null
        gem: PlacedBox | null
        pointer: PlacedBox | null
        titletier: PlacedBox | null
        titlegame: PlacedBox | null
        btnspin: PlacedBox | null
    }
}

export function layoutWheel(
    skin: WheelSkin,
    canvasWidth: number,
    canvasHeight: number,
    safeArea: TopRowInsets = {},
): WheelLayout {
    const board = boardLayout(skin, canvasWidth, canvasHeight, safeArea)
    const { fit, frameBox, backdrop } = board
    const w = Math.round(board.frame.width)
    const h = Math.round(board.frame.height)
    const floorCut = skin.floor?.[backdrop.cut]
    const floor = floorCut && frameBox ? { cut: backdrop.cut, place: placeInComposition(frameBox, floorCut.frame) } : undefined
    const sides = skin.sides ? placeBackdropSides(skin.backdropVideo, w, h) : undefined
    const boxes = {
        rim: place(fit, skin, 'rim'),
        facebase: place(fit, skin, 'facebase'),
        facesectors: place(fit, skin, 'facesectors'),
        gem: place(fit, skin, 'gem'),
        pointer: place(fit, skin, 'pointer'),
        titletier: place(fit, skin, 'titletier'),
        titlegame: place(fit, skin, 'titlegame'),
        btnspin: place(fit, skin, 'btnspin'),
    }
    return { ...board, floor, sides, boxes }
}

export { placeBox }
