# test-liveops-mini-games

The Daily Wheel and the Daily Scratcher (PixiJS, on `@betty-mini-games/test-liveops-sdk`) and the
frame FrontendV2 loads them in, stripped to the minimum for the performance tests.

- `frame/`: the page FrontendV2 keeps loaded and hidden in an iframe (web) or WebView (app). The
  host sends `{ "game": "daily-wheel", "tier": "Ruby" }` (or `"daily-scratcher"`) with
  `postMessage`; the game plays with its mock rewards; the page answers `"closed"` when the
  player is done. No staging, preloading, protocol, origin checks, haptics or safe-area relay.
- `src/games/`: every game. Their art is `public/test-liveops-assets/` (the test-liveops-assets
  repo, cloned there).
- `dev/`: one game on its own page, `/dev/?game=daily-wheel`, with the mock presets.

From the wrapper folder: `npm run frame`, then `http://localhost:8888/frame/?game=daily-wheel&tier=Diamond`.
