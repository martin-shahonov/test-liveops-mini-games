import { ViewAssets } from '@betty-mini-games/test-liveops-sdk'

import { ExampleGame } from './ExampleGame'
import { HelloWorldView } from './HelloWorldView'

/** This game's static files: public/test-liveops-assets/example/ (the test-liveops-assets repo, served as is next to the library's build). */
const assetsUrl = `${import.meta.env.BASE_URL}test-liveops-assets/example/`

/** Entry point of the game: builds it with its views and their assets. Call `start()` on the result. */
export function createGame(): ExampleGame {
    // Every view declares the assets it needs. The SDK loads them all before the views render.
    // Aliases are prefixed with the game id: all games share one PixiJS asset cache once they run in the library.
    // `createSpine('example/spineboy')` (see HelloWorld.ts) expects the aliases `example/spineboy-skel` and `example/spineboy-atlas`.
    const helloWorldAssets = new ViewAssets('helloWorld', [
        { alias: 'example/spineboy-skel', src: `${assetsUrl}spineboy/spineboy-pro.skel` },
        { alias: 'example/spineboy-atlas', src: `${assetsUrl}spineboy/spineboy-pma.atlas` },
    ])

    return new ExampleGame({
        views: [{ name: 'helloWorld', view: HelloWorldView, assets: helloWorldAssets }],
        app: { backgroundAlpha: 0, antialias: true },
    })
}
