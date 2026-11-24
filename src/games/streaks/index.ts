import { ViewAssets } from '@betty-mini-games/test-liveops-sdk'

import { StreaksGame } from './StreaksGame'
import { StreaksView } from './StreaksView'

/** This game's static files: public/test-liveops-assets/streaks/ (the test-liveops-assets repo, served as is next to the library's build). */
const assetsUrl = `${import.meta.env.BASE_URL}test-liveops-assets/streaks/`

/** Entry point of the game: builds it with its views and their assets. Call `start()` on the result. */
export function createGame(): StreaksGame {
    // Aliases are prefixed with the game id: all games share one PixiJS asset cache once they run in the library.
    // `createSpine('streaks/spineboy')` (see Streaks.ts) expects the aliases `streaks/spineboy-skel` and `streaks/spineboy-atlas`.
    const assets = new ViewAssets('streaks', [
        { alias: 'streaks/spineboy-skel', src: `${assetsUrl}spineboy/spineboy-pro.skel` },
        { alias: 'streaks/spineboy-atlas', src: `${assetsUrl}spineboy/spineboy-pma.atlas` },
    ])

    return new StreaksGame({
        views: [{ name: 'streaks', view: StreaksView, assets }],
        app: { backgroundAlpha: 0, antialias: true },
    })
}
