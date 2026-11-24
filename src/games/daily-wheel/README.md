# daily-wheel

Daily Wheel mini game, built with `@betty-mini-games/test-liveops-sdk`. Same structure as `../example/` (see its README).

For now a placeholder: Spineboy under the title, tap him to make him jump.

| File | |
|---|---|
| `index.ts` | Entry: `createGame()`, the views and their assets |
| `DailyWheelGame.ts` | The game's DI (its own state actions) and Game |
| `states/` | The game's state actions |
| `DailyWheelView.ts` | The view: centered, scaled to fit the screen |
| `DailyWheel.ts` | The content |

Static files: `public/test-liveops-assets/daily-wheel/` (the `test-liveops-assets` repo).
