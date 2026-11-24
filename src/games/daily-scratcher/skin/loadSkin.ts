import { fetchSkin } from '../../../shared/skin'
import type { ScratcherSkin } from '../ported/skins'

/** The skins the scratcher has art for (MiniGames' `SCRATCHER_SKINS`). Any other name draws the generic card. */
export const SCRATCHER_SKINS = ['generic'] as const

/**
 * The skin named `name`, or the generic card for none or one with no art (MiniGames'
 * `skinFor`). `base` is the daily scratcher's assets folder, ending in `/`.
 */
export async function loadSkin(base: string, name?: string): Promise<ScratcherSkin> {
    const known = name !== undefined && (SCRATCHER_SKINS as readonly string[]).includes(name)
    if (name !== undefined && !known) {
        console.warn(`[daily-scratcher] there is no art for the skin "${name}", so the generic card is drawn.`)
    }
    return fetchSkin<ScratcherSkin>(base, known ? name : 'generic')
}
