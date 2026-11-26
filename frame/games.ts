// Everything a game needs (PixiJS, the particles, the sound engine and its AudioContext), in its
// own chunk: main.ts loads it on the first open, so the frame costs next to nothing while it waits
// hidden in the lobby.
import { PIXI } from '@betty-mini-games/test-liveops-sdk'

import { forgetCutFrames } from '../src/shared/view/sheetTexture'

export { DailyWheelGame } from '../src/games/daily-wheel/DailyWheelGame'
export { DailyScratcherGame } from '../src/games/daily-scratcher/DailyScratcherGame'
export { assetsUrl as wheelBase } from '../src/games/daily-wheel'
export { assetsUrl as scratcherBase } from '../src/games/daily-scratcher'

/**
 * Everything the open game asked PixiJS to load (aliases and URLs). Every load goes through
 * `PIXI.Assets.load`: the SDK's asset lists and the win screen's lockup lights. The sounds are not
 * here: each game destroys its own when it closes.
 */
const loaded = new Set<string>()

type LoadInput = Parameters<typeof PIXI.Assets.load>[0]

function keysOf(input: LoadInput): string[] {
    const items = (Array.isArray(input) ? input : [input]) as unknown[]
    return items.flatMap((item) => {
        if (typeof item === 'string') return [item]
        if (item && typeof item === 'object') {
            const { alias, src } = item as { alias?: string | string[]; src?: unknown }
            if (alias !== undefined) return ([] as string[]).concat(alias)
            if (typeof src === 'string') return [src]
        }
        return []
    })
}

const load = PIXI.Assets.load.bind(PIXI.Assets)
PIXI.Assets.load = ((input: LoadInput, onProgress?: Parameters<typeof load>[1]) => {
    keysOf(input).forEach((key) => loaded.add(key))
    return load(input, onProgress)
}) as unknown as typeof PIXI.Assets.load

/**
 * Unloads the closed game's art (its textures, decoded images and GPU uploads), so memory goes back
 * to about the lobby's level after every game. The next open loads it again, from the browser's
 * cache. `?keepArt=1` on the frame's address keeps it instead (faster opens, more memory).
 */
export async function releaseArt(): Promise<void> {
    const keys = [...loaded]
    loaded.clear()
    forgetCutFrames()
    if (!keys.length) return
    try {
        await PIXI.Assets.unload(keys)
    } catch (error) {
        console.warn('[daily-games] the closed game\'s art could not all be released', error)
    }
}
