# streaks

Streaks mini game, built with `@betty-mini-games/test-liveops-sdk`. Same structure as `../example/` (see its README).

For now a placeholder: Spineboy under the title, tap him to make him jump.

| File | |
|---|---|
| `index.ts` | Entry: `createGame()`, the views and their assets |
| `StreaksGame.ts` | The game's DI (its own state actions) and Game |
| `states/` | The game's state actions |
| `StreaksView.ts` | The view: centered, scaled to fit the screen |
| `Streaks.ts` | The content |

Static files: `public/test-liveops-assets/streaks/` (the `test-liveops-assets` repo).
