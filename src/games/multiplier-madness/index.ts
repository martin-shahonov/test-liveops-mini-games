import { ViewAssets } from '@betty-mini-games/test-liveops-sdk'

import { MultiplierMadnessGame } from './MultiplierMadnessGame'
import { MultiplierMadnessView } from './MultiplierMadnessView'

/** This game's static files: public/test-liveops-assets/multiplier-madness/ (the test-liveops-assets repo, served as is next to the library's build). */
const assetsUrl = `${import.meta.env.BASE_URL}test-liveops-assets/multiplier-madness/`

/** Entry point of the game: builds it with its views and their assets. Call `start()` on the result. */
export function createGame(): MultiplierMadnessGame {
    // Aliases are prefixed with the game id: all games share one PixiJS asset cache once they run in the library.
    // `createSpine('multiplier-madness/spineboy')` (see MultiplierMadness.ts) expects the aliases `multiplier-madness/spineboy-skel` and `multiplier-madness/spineboy-atlas`.
    const assets = new ViewAssets('multiplier-madness', [
        { alias: 'multiplier-madness/spineboy-skel', src: `${assetsUrl}spineboy/spineboy-pro.skel` },
        { alias: 'multiplier-madness/spineboy-atlas', src: `${assetsUrl}spineboy/spineboy-pma.atlas` },
    ])

    return new MultiplierMadnessGame({
        views: [{ name: 'multiplier-madness', view: MultiplierMadnessView, assets }],
        app: { backgroundAlpha: 0, antialias: true },
    })
}
