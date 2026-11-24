import { PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { SpriteSheet } from '../types'

const FRAME_STRIDE = 7

/**
 * A sequence's frames as Pixi textures, each the size of the untrimmed canvas
 * (`sourceWidth` x `sourceHeight`) with its trim, so every frame lands where the
 * export drew it. `null` for an empty frame (a pause in the sequence).
 * The pages must be loaded (`PIXI.Assets`) under their own URLs.
 */
export function sheetTextures(sheet: SpriteSheet): (PIXI.Texture | null)[] {
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
    return out
}

/** Every page image a sequence draws from. */
export const sheetImages = (sheets: readonly (SpriteSheet | undefined)[]): string[] =>
    [...new Set(sheets.flatMap((sheet) => (sheet ? [...sheet.images] : [])))]
