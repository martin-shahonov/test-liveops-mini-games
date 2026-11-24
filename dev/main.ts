// Runs one game on its own page, without the library's initializer or a casino: /dev/?game=<id>
// The mock host loads this page in its iframes. Started by `npm run dev` from the liveops folder.

interface GameModule {
    createGame(): { start(): Promise<void> }
}

// Every game folder with an index.ts, loaded only when asked for
const games = import.meta.glob<GameModule>('../src/games/*/index.ts')
const idOf = (path: string) => path.split('/').at(-2)!

const id = new URLSearchParams(location.search).get('game') ?? 'example'
const load = Object.entries(games).find(([path]) => idOf(path) === id)?.[1]

if (load) {
    const { createGame } = await load()
    await createGame().start()
} else {
    document.body.textContent = `Unknown game "${id}". Available: ${Object.keys(games).map(idOf).join(', ')}`
}
