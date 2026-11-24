# ported

Pure logic from **MiniGames 0.11.0** (`Betty-Gaming/MiniGames`), copied as is so the
Daily Wheel here computes exactly what the React Native wheel computes: layout, the
spin's curves, the win's timing. Only their imports were changed, to point at the
copies beside them, plus what a JSON skin needs (`lights[i]` for `lightAtIndex(i)`).

| Folder | From |
|---|---|
| `engine/` | `packages/engine/src` |
| `runtime/` | `packages/runtime/src` (layout, text metrics, frame) |
| `win/` | `packages/win/src` |
| `wheel/` | `games/wheel/src` |

Nothing here imports Pixi, the DOM or React. When MiniGames changes one of these,
copy it again rather than editing it here.
