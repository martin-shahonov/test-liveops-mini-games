# example

The smallest game built with `@betty-mini-games/test-liveops-sdk`: Spineboy (Spine) walking under a "Hello World" title (PixiJS text animated with GSAP). Tap Spineboy to make him jump.

Start here when you build a new mini game.

## Run it

From the `liveops` root:

```sh
npm run setup   # once
npm run dev
```

Then open the Example tab of the mock host (http://localhost:8080), or the game alone: http://localhost:8888/dev/?game=example

## How it is put together

| File | What it shows |
|---|---|
| `index.ts` | The game's entry: declaring its views and their assets, creating the game |
| `ExampleGame.ts` | Plugging the game's own state actions into the SDK (a `DI` subclass, used by a `Game` subclass) |
| `states/` | The game's state actions. The SDK's do nothing on their own: implement `onEnter()` for every state the game goes through. The SDK's controller moves the machine from `idle` to `init` once the views are rendered |
| `HelloWorldView.ts` | A `View`: built in `render()` (assets are loaded by then), centered and scaled to fit on resize, cleaned up in `destroy()` |
| `HelloWorld.ts` | A `GameObject`: a Spine animation from `createSpine()`, PixiJS text, GSAP tweens, a tap handler |
| `public/test-liveops-assets/example/spineboy/` (library root, the `test-liveops-assets` repo) | Spine export (`.skel` + `.atlas` + `.png`), served as is |
| `dev/` (library root) | The page that runs any game on its own: `/dev/?game=<id>` |

## Rules for every game

- A game lives in `src/games/<id>/` and imports only from `@betty-mini-games/test-liveops-sdk` and its own folder (never from the rest of the library).
- Its static files go in `public/test-liveops-assets/<id>/` (the `test-liveops-assets` repo).
- Import PixiJS, GSAP and Spine **from the SDK** (`PIXI`, `gsap`, `Spine`), never from `pixi.js` / `gsap` / `@esotericsoftware/spine-pixi-v8` directly. The SDK is the only package that declares them, so every game and the library share one copy and one version.
- Spine exports must match the runtime version: `spine-pixi-v8` 4.3.x reads Spine 4.3 exports.
- Asset aliases start with the game id (`<id>/...`): all games share one PixiJS asset cache once they run in the library.
- Assets with Spine: give the skeleton and the atlas the aliases `<id>/<name>-skel` and `<id>/<name>-atlas`, then call `createSpine('<id>/<name>')`.

## Credits

Spineboy is Esoteric Software's example character, from the [spine-runtimes](https://github.com/EsotericSoftware/spine-runtimes/tree/4.3/examples/spineboy) repository (4.3 branch). Using Spine runtimes and exports in a product requires a Spine license.
