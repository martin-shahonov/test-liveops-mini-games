import { PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { BitmapFont, BitmapGlyph } from '../ported/runtime/text/metrics'
import { glyphLead, measureBitmapText } from '../ported/runtime/text/metrics'
import { texture } from './util'

/**
 * Glyphs already cut, by atlas. Keyed by the atlas's source (kept by PixiJS's assets cache for
 * every game), not by the font object, which each open reads anew: else every open would cut
 * its glyphs again and leave them listening to the atlas, never freed.
 */
const glyphTextures = new WeakMap<PIXI.TextureSource, Map<string, PIXI.Texture>>()

function glyphTexture(font: BitmapFont, ch: string, glyph: BitmapGlyph): PIXI.Texture {
    const atlas = texture(String(font.source))
    // The atlas may be drawn at another size than the font's own numbers say.
    const sx = atlas.width / font.atlasWidth
    const sy = atlas.height / font.atlasHeight
    let byChar = glyphTextures.get(atlas.source)
    if (!byChar) {
        byChar = new Map()
        glyphTextures.set(atlas.source, byChar)
    }
    const key = `${ch}:${glyph.x},${glyph.y},${glyph.w},${glyph.h}:${sx},${sy}`
    let made = byChar.get(key)
    if (!made) {
        made = new PIXI.Texture({
            source: atlas.source,
            frame: new PIXI.Rectangle(glyph.x * sx, glyph.y * sy, glyph.w * sx, glyph.h * sy),
        })
        byChar.set(key, made)
    }
    return made
}

/**
 * MiniGames' `BitmapText`: a line of glyphs cut from a font's atlas, each in its cell
 * (`createCellStyles`): its lead and advance across, its `yoffset` down a line box
 * `lineHeight` tall. Drawn from (0, 0), the line box's top left; `width` is the advance.
 */
export class BitmapLine extends PIXI.Container {
    lineWidth = 0
    readonly lineHeight: number
    protected _text = ''

    constructor(
        text: string,
        protected _font: BitmapFont,
        protected _size: number,
    ) {
        super()
        this.lineHeight = _font.lineHeight * (_size / _font.lineHeight)
        this.text = text
    }

    get text(): string {
        return this._text
    }

    /** Spells `value`, its glyphs made again only where they changed. */
    set text(value: string) {
        if (value === this._text && this.children.length) return
        this._text = value
        const font = this._font
        const scale = this._size / font.lineHeight
        const chars = Array.from(value).filter((ch) => font.glyphs[ch])
        while (this.children.length > chars.length) this.removeChildAt(this.children.length - 1).destroy()
        let pen = 0
        chars.forEach((ch, i) => {
            const glyph = font.glyphs[ch]!
            let sprite = this.children[i] as PIXI.Sprite | undefined
            if (!sprite) {
                sprite = new PIXI.Sprite()
                this.addChild(sprite)
            }
            sprite.texture = glyphTexture(font, ch, glyph)
            sprite.position.set(pen + glyphLead(glyph) * scale, (glyph.yoffset ?? 0) * scale)
            sprite.width = glyph.w * scale
            sprite.height = glyph.h * scale
            pen += glyph.advance * scale
        })
        this.lineWidth = measureBitmapText(value, font, this._size)
    }
}
