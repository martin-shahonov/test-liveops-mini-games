import { ViewAssets } from '@betty-mini-games/test-liveops-sdk'

import { CollectionsGame } from './CollectionsGame'
import { CollectionsView } from './CollectionsView'

/** This game's static files: public/test-liveops-assets/collections/ (the test-liveops-assets repo, served as is next to the library's build). */
const assetsUrl = `${import.meta.env.BASE_URL}test-liveops-assets/collections/`

/** Entry point of the game: builds it with its views and their assets. Call `start()` on the result. */
export function createGame(): CollectionsGame {
    // Aliases are prefixed with the game id: all games share one PixiJS asset cache once they run in the library.
    // `createSpine('collections/spineboy')` (see Collections.ts) expects the aliases `collections/spineboy-skel` and `collections/spineboy-atlas`.
    const assets = new ViewAssets('collections', [
        { alias: 'collections/spineboy-skel', src: `${assetsUrl}spineboy/spineboy-pro.skel` },
        { alias: 'collections/spineboy-atlas', src: `${assetsUrl}spineboy/spineboy-pma.atlas` },
    ])

    return new CollectionsGame({
        views: [{ name: 'collections', view: CollectionsView, assets }],
        app: { backgroundAlpha: 0, antialias: true },
    })
}
