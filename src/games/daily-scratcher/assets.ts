import type { AssetDefinition } from '@betty-mini-games/test-liveops-sdk'

import type { ScratcherSkin } from './ported/skins'
import type { ScratcherCard } from './ported/rules'
import { isSymbolId } from './ported/skins'

/**
 * Every image the card draws for `skin` and `card`, loaded before it shows: both cuts'
 * backdrops, the card's stills, the tiles and their looks, the card's symbols and their
 * shadows and dark copies, the value and top prize fonts, the coatings, the button and
 * the top row.
 */
export function cardAssets(skin: ScratcherSkin, card: ScratcherCard, base: string): AssetDefinition[] {
    const urls = new Set<string>([
        ...Object.values(skin.sources),
        ...Object.values(skin.ui),
        skin.coatings.winning.source,
        skin.coatings.yours.source,
        skin.grit,
        skin.scratchCoin.sheet,
        String(skin.valueLine.sheet.font.source),
        String(skin.valueLine.glow.source),
        String(skin.valueLine.dark.source),
        String(skin.topPrizeValue.sheet.font.source),
        skin.matchGlows.tile.full,
        skin.matchGlows.tile.narrow,
        `${base}ui/hud/iconsoundon.webp`,
        `${base}ui/hud/iconsoundoff.webp`,
        `${base}ui/hud/iconhelp.webp`,
        `${base}ui/hud/iconclose.webp`,
    ])
    for (const tile of [skin.tiles.full, skin.tiles.narrow]) [tile.source, tile.match, tile.dark].forEach((url) => urls.add(url))
    const poster = skin.backdropPoster
    if (poster && typeof poster === 'object') [poster.portrait, poster.square].forEach((url) => urls.add(String(url)))
    else if (poster !== undefined) urls.add(String(poster))
    for (const id of new Set([...card.winning, ...card.cells.map((cell) => cell.symbol)])) {
        if (!isSymbolId(id)) continue
        const art = skin.symbolArt[id]
        ;[art.source, art.dark, art.shadow.source].forEach((url) => urls.add(url))
    }
    if (skin.glows) skin.glows.button.loop.images.forEach((url) => urls.add(url))
    // The motion designer's animations, the card's and the win's.
    const a = skin.animations
    if (a) {
        for (const sheet of [a.rim.sheet, a.title.sheet, a.topPrize.sheet, a.fields.sheet, a.back.sheet, a.tile.back, a.tile.frameIn, a.tile.frameIdle]) {
            sheet.images.forEach((url) => urls.add(url))
        }
    }
    // The win screen, but for the lockups' lights, which load for the tier a claim names.
    const win = skin.winScreen
    for (const tier of Object.values(win.tiers)) {
        urls.add(tier.lockup.words.tier.source)
        urls.add(tier.lockup.words.win.source)
    }
    urls.add(win.coin.source)
    win.coin.flip?.clip.images.forEach((url) => urls.add(url))
    urls.add(String(win.counter.font.source))
    for (const bundle of [win.sparks, win.shower.bundle, win.particles.bundle]) {
        Object.values(bundle.textures).forEach((url) => urls.add(url))
    }
    return [...urls].map((url) => ({ alias: url, src: url }))
}
