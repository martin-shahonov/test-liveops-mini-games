import type { WheelSkin } from './types'
import { resolvePaths } from '../../../shared/skin'

/** The skins' index: which file holds each loyalty tier's skin. */
type SkinIndex = { version: string; tiers: Record<string, string>; fallback: string }

export type LoadedSkin = { skin: WheelSkin; tierName: string; unknownTier?: string }

/**
 * The skin for `loyaltyTier`, or the fallback's (Member) for a tier with no art, as MiniGames' `skinForTier`.
 * `base` is the daily wheel's assets folder, ending in `/`.
 */
export async function loadSkin(base: string, loyaltyTier: string | undefined): Promise<LoadedSkin> {
    const index = (await (await fetch(`${base}skins/index.json`)).json()) as SkinIndex
    const own = loyaltyTier ? index.tiers[loyaltyTier] : undefined
    const id = own ?? index.tiers[index.fallback]!
    const raw = (await (await fetch(`${base}skins/${id}.json`)).json()) as WheelSkin
    const skin = resolvePaths(raw, base)
    if (loyaltyTier && !own) {
        console.warn(`[daily-wheel] there is no art for "${loyaltyTier}", so the ${skin.name} wheel is drawn.`)
    }
    return { skin, tierName: skin.name, ...(loyaltyTier && !own ? { unknownTier: loyaltyTier } : {}) }
}
