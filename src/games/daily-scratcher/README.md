# daily-scratcher

Daily Scratcher mini game, built with `@betty-mini-games/test-liveops-sdk`. Same structure as `../example/` (see its README).

For now a placeholder: Spineboy under the title, tap him to make him jump.

| File | |
|---|---|
| `index.ts` | Entry: `createGame()`, the views and their assets |
| `DailyScratcherGame.ts` | The game's DI (its own state actions) and Game |
| `states/` | The game's state actions |
| `DailyScratcherView.ts` | The view: centered, scaled to fit the screen |
| `DailyScratcher.ts` | The content |

Static files: `public/test-liveops-assets/daily-scratcher/` (the `test-liveops-assets` repo).
