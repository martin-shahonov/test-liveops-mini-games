import type { AssetDefinition } from '@betty-mini-games/test-liveops-sdk'

import type { SpriteSheet, WheelSkin } from './skin/types'

const sheetImages = (sheets: readonly (SpriteSheet | undefined)[]) => sheets.flatMap((sheet) => sheet?.images ?? [])

/**
 * Every image the board draws for `skin`, loaded before it shows: the stills, both
 * cuts' posters and floors (a resize can switch cut), the floor's shines, the glows' sheets, the prize
 * fonts, the button and the top row. Only this tier's files: the other nine are never loaded.
 */
export function boardAssets(skin: WheelSkin, base: string): AssetDefinition[] {
    const urls = new Set<string>([
        ...Object.values(skin.sources),
        ...Object.values(skin.ui),
        String(skin.labels.fonts.onLight.source),
        String(skin.labels.fonts.onDark.source),
        `${base}ui/hud/iconsoundon.webp`,
        `${base}ui/hud/iconsoundoff.webp`,
        `${base}ui/hud/iconhelp.webp`,
        `${base}ui/hud/iconclose.webp`,
    ])
    const poster = skin.backdropPoster
    if (poster && typeof poster === 'object') [poster.portrait, poster.square].forEach((url) => urls.add(String(url)))
    else if (poster !== undefined) urls.add(String(poster))
    if (skin.floor) {
        for (const cut of [skin.floor.portrait, skin.floor.square]) {
            urls.add(cut.still.source)
            sheetImages(cut.shines.flatMap((shine) => shine.clips)).forEach((url) => urls.add(url))
        }
    }
    const glows = skin.glows
    if (glows) {
        sheetImages([
            glows.rim.intro,
            glows.rim.idle,
            glows.sector.intro,
            glows.sector.idle,
            glows.button.loop,
            glows.title?.loop,
        ]).forEach((url) => urls.add(url))
    }
    // The win screen, but for the lockups' lights, which load for the tier a claim names (`WinScreen.prepare`).
    const win = skin.winScreen
    for (const tier of Object.values(win.tiers)) {
        urls.add(tier.lockup.words.tier.source)
        urls.add(tier.lockup.words.win.source)
    }
    urls.add(win.coin.source)
    sheetImages([win.coin.flip?.clip, win.glow.intro, win.glow.idle]).forEach((url) => urls.add(url))
    urls.add(String(win.counter.font.source))
    for (const bundle of [win.sparks, win.shower.bundle, win.particles.bundle]) {
        Object.values(bundle.textures).forEach((url) => urls.add(url))
    }
    return [...urls].map((url) => ({ alias: url, src: url }))
}
