import type { PlacedBox } from '../../../shared/ported/runtime/layout/fit'
import type { TopRowInsets } from '../../../shared/ported/runtime/layout/topRow'
import { boardLayout, type BoardLayout } from '../../../shared/view/boardLayout'
import type { ScratcherSkin } from '../ported/skins'
import { placeScreenArt, type ScreenArt } from '../ported/placeScreenArt'
import type { CellBox } from '../ported/tray'

/**
 * Where everything goes for one canvas size: MiniGames' `Board` and `DailyScratcherScreen`
 * layout (`placeScreenArt`), worked out by the same functions (see `ported/`). Boxes are
 * in CSS pixels, from the game frame's top left corner.
 */
export type CardLayoutOnScreen = BoardLayout & {
    placed: ScreenArt
    /** A box in board points on the screen (MiniGames' `onScreen`). */
    onScreen: (box: CellBox) => PlacedBox
}

export function layoutCard(
    skin: ScratcherSkin,
    canvasWidth: number,
    canvasHeight: number,
    safeArea: TopRowInsets = {},
): CardLayoutOnScreen {
    const board = boardLayout(skin, canvasWidth, canvasHeight, safeArea)
    const { fit } = board
    return {
        ...board,
        placed: placeScreenArt(fit, skin),
        onScreen: (box) => ({
            left: fit.offsetX + box.left * fit.k,
            top: fit.offsetY + box.top * fit.k,
            width: box.width * fit.k,
            height: box.height * fit.k,
        }),
    }
}
