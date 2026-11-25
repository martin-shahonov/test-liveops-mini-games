import { PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { SpriteSheet } from '../types'

const FRAME_STRIDE = 7

/**
 * Frames already cut, by sheet. Each frame is a texture on a page that PixiJS's assets cache keeps
 * for every game, and each one listens to its page: cut again on every open, they would pile up
 * on the page, never freed. The sheets are the same from one open to the next, so they are cut once.
 */
const cut = new Map<string, (PIXI.Texture | null)[]>()

const keyOf = (sheet: SpriteSheet): string =>
    `${sheet.images.join('|')}#${sheet.count}#${sheet.sourceWidth}x${sheet.sourceHeight}#${sheet.frames.join(',')}`

/**
 * A sequence's frames as Pixi textures, each the size of the untrimmed canvas
 * (`sourceWidth` x `sourceHeight`) with its trim, so every frame lands where the
 * export drew it. `null` for an empty frame (a pause in the sequence).
 * The pages must be loaded (`PIXI.Assets`) under their own URLs.
 */
export function sheetTextures(sheet: SpriteSheet): (PIXI.Texture | null)[] {
    const key = keyOf(sheet)
    const known = cut.get(key)
    // Still cut from the pages the cache holds (they were not unloaded and loaded again since).
    const first = known?.find((frame) => frame !== null)
    const page = sheet.images[sheet.pages[sheet.empty.indexOf(false)] ?? 0]
    if (known && (!first || (page && first.source === PIXI.Assets.get<PIXI.Texture>(page)?.source))) return known
    const out: (PIXI.Texture | null)[] = []
    for (let i = 0; i < sheet.count; i++) {
        if (sheet.empty[i]) {
            out.push(null)
            continue
        }
        const page = PIXI.Assets.get<PIXI.Texture>(sheet.images[sheet.pages[i] ?? 0]!)
        const o = i * FRAME_STRIDE
        const [x, y, w, h, rotated, tx, ty] = sheet.frames.slice(o, o + FRAME_STRIDE) as number[]
        const turned = rotated === 1
        out.push(
            new PIXI.Texture({
                source: page.source,
                // TexturePacker keeps a turned frame on its side: its rect in the page is h x w.
                frame: new PIXI.Rectangle(x!, y!, turned ? h! : w!, turned ? w! : h!),
                orig: new PIXI.Rectangle(0, 0, sheet.sourceWidth, sheet.sourceHeight),
                trim: new PIXI.Rectangle(tx!, ty!, w!, h!),
                rotate: turned ? PIXI.groupD8.S : 0,
            }),
        )
    }
    cut.set(key, out)
    return out
}

/** Every page image a sequence draws from. */
export const sheetImages = (sheets: readonly (SpriteSheet | undefined)[]): string[] =>
    [...new Set(sheets.flatMap((sheet) => (sheet ? [...sheet.images] : [])))]
