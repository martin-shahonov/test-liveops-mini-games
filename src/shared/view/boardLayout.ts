import { Device } from '@betty-mini-games/test-liveops-sdk'

import { devNumber } from '../devParams'

import {
    backdropBox,
    croppedBackdropBox,
    fitBoard,
    focusedBackdropBox,
    type BoardFit,
    type BoardSpec,
    type PlacedBox,
} from '../ported/runtime/layout/fit'
import {
    pickBackdropCrop,
    pickBackdropCut,
    pickBackdropPoster,
    type BackdropPoster,
    type BackdropVideo,
} from '../ported/runtime/layout/videoSource'
import { gameFrame, gameSheetRadius } from '../ported/runtime/shell/frame'
import { placeHud, type HudPlaces, type TopRowInsets } from '../ported/runtime/layout/topRow'

/** A board skin, as MiniGames' `Board` draws it: its spec, and its backdrop's still and video. */
export type BoardSkin = BoardSpec & {
    backdropVideo?: BackdropVideo
    backdropPoster?: BackdropPoster
    wideScreen?: BoardSpec['wideScreen'] & { backdrop?: { aspect: number; focus: number } }
}

/**
 * Where a board goes for one canvas size, as MiniGames' `Board` and `TopRowSlot` lay it
 * out: the game frame (the whole canvas on a phone, a rounded popup on a desktop), the
 * board fitted in it, the backdrop and the top row. Boxes are in CSS pixels, from the
 * frame's top left corner.
 */
export type BoardLayout = {
    frame: { left: number; top: number; width: number; height: number; radius: number }
    fit: BoardFit
    /** The backdrop's cut, still and box (the poster and the video share it). */
    backdrop: { cut: 'portrait' | 'square'; poster?: string; box: PlacedBox | null }
    /** The frame grown by the backdrop's overscan, before any crop or focus. */
    frameBox: PlacedBox | null
    hud: HudPlaces
    fillsWindow: boolean
}

export function boardLayout(
    skin: BoardSkin,
    canvasWidth: number,
    canvasHeight: number,
    safeArea: TopRowInsets = {},
): BoardLayout {
    const input = { width: canvasWidth, height: canvasHeight, isTouch: Device.isTouch }
    const sized = gameFrame(input)
    const width = typeof sized.width === 'number' ? sized.width : canvasWidth
    const height = sized.height
    const fillsWindow = typeof sized.width !== 'number'
    const frame = {
        left: (canvasWidth - width) / 2,
        top: (canvasHeight - height) / 2,
        width,
        height,
        radius: gameSheetRadius(input),
    }

    // Measured sizes are rounded in Board, so the layout never oscillates.
    const w = Math.round(width)
    const h = Math.round(height)
    const fit = fitBoard(skin, w, h)

    // Board: the poster and the video, in the frame grown by the overscan, a cut cropped to its rows.
    const video = skin.backdropVideo
    const frameBox = backdropBox(w, h)
    const crop = pickBackdropCrop(video, w, h)
    const focus = fit.band ? skin.wideScreen?.backdrop : undefined
    const box =
        frameBox && crop
            ? croppedBackdropBox(frameBox, crop.frame, crop.top, crop.height)
            : frameBox && focus
              ? focusedBackdropBox(frameBox, focus.aspect, focus.focus, h / 2)
              : frameBox
    const cut = pickBackdropCut(video, w, h)
    const poster =
        skin.backdropPoster === undefined ? undefined : String(pickBackdropPoster(skin.backdropPoster, video, w, h))

    // TopRowSlot: the HUD's rule over the frame, the window's insets only when the frame fills it.
    const hud = placeHud({ width: fit.frameWidth, height: fit.frameHeight }, fillsWindow ? safeArea : { top: 0 })

    return { frame, fit, backdrop: { cut, poster, box }, frameBox, hud, fillsWindow }
}

/**
 * The page's own safe-area insets (`env(safe-area-inset-*)`), 0 where it has none; or the
 * notch the dev page presets (`?safeTop=`, `?safeLeft=`, `?safeRight=`), as a phone's would be.
 */
export function readSafeArea(): { top: number; left: number; right: number } {
    const preset = { top: devNumber('safeTop'), left: devNumber('safeLeft'), right: devNumber('safeRight') }
    if (preset.top !== undefined || preset.left !== undefined || preset.right !== undefined) {
        return { top: preset.top ?? 0, left: preset.left ?? 0, right: preset.right ?? 0 }
    }
    const probe = document.createElement('div')
    probe.style.cssText =
        'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)'
    document.body.appendChild(probe)
    const style = getComputedStyle(probe)
    const insets = {
        top: parseFloat(style.paddingTop) || 0,
        left: parseFloat(style.paddingLeft) || 0,
        right: parseFloat(style.paddingRight) || 0,
    }
    probe.remove()
    return insets
}
