// The daily games frame, for measuring what the iframe (web) and the WebView (app) cost, one step
// of the measuring ladder at a time. The host (FrontendV2) climbs it with commands:
//
//   { "cmd": "code" }                     load and run the games' code (PixiJS, Spine, GSAP, XState, sound, particles)
//   { "cmd": "engine" }                   + a PixiJS app made and drawn once, no art (WebGL context, buffers, shaders)
//   { "cmd": "art", "game", "tier"? }     + the game made, its art loaded and drawn once, out of sight
//   { "cmd": "play", "game", "tier"? }    + the game shown and played
//   { "cmd": "teardown" }                 everything let go, before the host removes the frame: answers `torn-down`
//
// Each command runs the steps below it first if they have not run (`play` from the page alone runs
// code, engine and art). The frame answers `level:<step>` each time it reaches one (`level:shell`
// once the page is up), `error:<text>` if a step failed, and `closed` when the player closes the
// game: its art is released and the frame is back at `engine` (or `code` if the engine never ran).
// `{ "game", "tier"? }` alone (the frame's first protocol, and `__perf.open`) is `play`.
//
// Opened on its own (top level, not in a host), the frame shows those steps as buttons.
// `?stage=code|engine` climbs that far as the page loads. `?game=`, `?tier=`: the game on its own.
type Games = typeof import('./games')
type Game = InstanceType<Games['DailyWheelGame']> | InstanceType<Games['DailyScratcherGame']>
type RNWindow = Window & { ReactNativeWebView?: { postMessage(data: string): void } }

const LEVELS = ['shell', 'code', 'engine', 'art', 'playing'] as const
type Level = (typeof LEVELS)[number]
type Command = { cmd: 'code' | 'engine' | 'art' | 'play' | 'teardown'; game?: string; tier?: string }

const params = new URLSearchParams(location.search)
/** `?keepArt=1`: keep a closed game's art for the next open, instead of releasing it. */
const keepArt = params.has('keepArt')
const inHost = Boolean((window as RNWindow).ReactNativeWebView) || window.parent !== window

function tellHost(data: string): void {
    const rn = (window as RNWindow).ReactNativeWebView
    if (rn) rn.postMessage(data)
    else if (window.parent !== window) window.parent.postMessage(data, '*')
}

/** A step reached: a performance mark (`stage:<name>`, see `__perf.marks()`) and a console line. */
function mark(name: string): void {
    performance.mark(`stage:${name}`)
    console.info(`[daily-games] ${name} at ${Math.round(performance.now())} ms`)
}

let level: Level = 'shell'
function reach(next: Level): void {
    level = next
    tellHost(`level:${next}`)
    panel?.render()
}

let code: Games | undefined
/** The engine was started once: after a game closes, the frame warms it again. */
let engineWanted = false
let engineWarm = false
/** The game made and loaded (out of sight until `play`), or on screen. */
let game: { id: string; tier?: string; instance: Game; container: HTMLElement } | undefined
/** A closed game's art being released: the next game waits for it, so it does not load what is being unloaded. */
let releasing: Promise<void> = Promise.resolve()

async function toCode(): Promise<Games> {
    if (code) return code
    code = await import('./games')
    mark('code-ready')
    reach('code')
    return code
}

async function toEngine(): Promise<Games> {
    const games = await toCode()
    engineWanted = true
    if (engineWarm || game) return games
    await releasing
    await games.warmEngine()
    engineWarm = true
    mark('engine-ready')
    reach('engine')
    return games
}

async function toArt(id: string, tier?: string): Promise<Game> {
    const games = await toEngine()
    if (game && game.id === id && game.tier === tier) return game.instance
    if (game) closeGame(game.instance, false)
    await releasing
    // One WebGL context at a time: the warm engine goes, the game makes its own.
    await games.dropEngine()
    engineWarm = false
    const container = document.createElement('div')
    container.className = 'game'
    // Out of sight until `play`, its canvas laid out for the screen all the same.
    container.style.visibility = 'hidden'
    document.body.appendChild(container)
    const onClose = () => closeGame(instance, true)
    const instance: Game =
        id === 'daily-scratcher'
            ? new games.DailyScratcherGame({ base: games.scratcherBase, placement: 'daily', container, onClose })
            : new games.DailyWheelGame({ base: games.wheelBase, loyaltyTier: tier, container, onClose })
    game = { id, tier, instance, container }
    mark('art-loading')
    // Out of sight: its videos wait for `play`.
    games.holdVideos(true)
    try {
        // The canvas made, the art loaded, the views drawn once (the art goes up to the GPU).
        await instance.prepare()
    } catch (error) {
        closeGame(instance, false)
        throw error
    }
    // Nothing draws while it waits.
    instance.sleep()
    mark('art-ready')
    reach('art')
    return instance
}

async function play(id: string, tier?: string): Promise<void> {
    const instance = await toArt(id, tier)
    if (level === 'playing') return
    // For the probe: the open it measures starts here, at the play.
    window.dispatchEvent(new CustomEvent('daily-games:open', { detail: { game: id } }))
    game!.container.style.visibility = ''
    code?.holdVideos(false)
    await instance.start()
    mark('game-on-screen')
    reach('playing')
    // What it draws with, for the inspector: webgl normally; canvas would mean no WebGL (slow).
    console.info(`[daily-games] ${id} on ${(instance.app.renderer as { name?: string }).name ?? '?'}`)
}

/**
 * The game goes: its canvas, then its art, then (if the engine was started on the ladder) the warm
 * engine again: back to the level from before the art. `byPlayer`: the player closed it (the host
 * hides the frame on `closed`).
 */
function closeGame(instance: Game, byPlayer: boolean): void {
    if (game?.instance !== instance) return
    const { container } = game
    game = undefined
    instance.destroy()
    const games = code!
    releasing = new Promise((done) =>
        setTimeout(() => {
            container.remove()
            ;(keepArt ? Promise.resolve() : games.releaseArt())
                .then(() => mark('art-released'))
                .then(async () => {
                    // Replaced by another game (`art` for another one): that one goes on from here.
                    if (!byPlayer || game) return
                    if (engineWanted) {
                        await games.warmEngine()
                        engineWarm = true
                        mark('engine-ready')
                    }
                    reach(engineWarm ? 'engine' : 'code')
                })
                .then(done, (error: unknown) => {
                    console.error('[daily-games] after the game', error)
                    done()
                })
        }, 0),
    )
    if (byPlayer) {
        mark('game-closed')
        tellHost('closed')
    }
}

/**
 * Before the host removes the frame: the game, its art, the engine and the sound let go now, so
 * their memory (the GPU's included) goes when the frame does, not whenever the garbage collector
 * gets to them (never soon, for a frame in the host's own process: the same site, as in local runs).
 */
async function teardownAll(): Promise<void> {
    if (game) closeGame(game.instance, false)
    await releasing
    engineWanted = false
    engineWarm = false
    if (code) await code.teardown()
    mark('torn-down')
    tellHost('torn-down')
}

// The page going without a teardown (the WebView destroyed, the iframe removed, a reload): at least
// the WebGL contexts go at once, with their GPU memory.
window.addEventListener('pagehide', () => {
    if (game) code?.loseContext(game.instance.app)
    code?.loseEngineContext()
})

/** One command at a time, in order. */
let queue: Promise<unknown> = Promise.resolve()
function run(command: Command): void {
    queue = queue.then(async () => {
        try {
            if (command.cmd === 'code') await toCode()
            else if (command.cmd === 'engine') await toEngine()
            else if (command.cmd === 'art') await toArt(command.game ?? 'daily-wheel', command.tier)
            else if (command.cmd === 'play') await play(command.game ?? 'daily-wheel', command.tier)
            else if (command.cmd === 'teardown') await teardownAll()
        } catch (error) {
            console.error(`[daily-games] ${command.cmd} failed`, error)
            if (command.cmd === 'code') code = undefined
            tellHost(`error:${command.cmd}: ${error instanceof Error ? error.message : String(error)}`)
            // A game that could not start must not leave the host's frame over the app.
            if (command.cmd === 'play') tellHost('closed')
            reach(level)
        }
    })
}

function receive(data: unknown): void {
    let message = data
    if (typeof message === 'string') {
        try {
            message = JSON.parse(message)
        } catch {
            return
        }
    }
    if (!message || typeof message !== 'object') return
    const { cmd, game: id, tier } = message as { cmd?: unknown; game?: unknown; tier?: unknown }
    const named = typeof id === 'string' ? id : undefined
    const tiered = typeof tier === 'string' ? tier : undefined
    if (cmd === 'code' || cmd === 'engine' || cmd === 'art' || cmd === 'play' || cmd === 'teardown') {
        run({ cmd, game: named, tier: tiered })
    }
    else if (cmd === undefined && named) run({ cmd: 'play', game: named, tier: tiered })
}

window.addEventListener('message', (event) => receive(event.data))
// react-native-webview delivers on `document` on Android.
document.addEventListener('message', (event) => receive((event as MessageEvent).data))

/** The ladder as buttons, for the frame on its own (no host to show them). Plain DOM, no PixiJS. */
const panel = inHost ? undefined : makePanel()

function makePanel() {
    const GAMES: Record<string, string> = { 'daily-wheel': 'Daily Wheel', 'daily-scratcher': 'Daily Scratcher' }
    let id = params.get('game') ?? 'daily-wheel'
    const tier = params.get('tier') ?? undefined
    const root = document.createElement('div')
    root.className = 'ladder'
    document.body.appendChild(root)
    const steps: { level: Level; label: () => string; cmd: Command['cmd'] }[] = [
        { level: 'code', label: () => "Load the games' code", cmd: 'code' },
        { level: 'engine', label: () => 'Start the engine (no art)', cmd: 'engine' },
        { level: 'art', label: () => `Load the ${GAMES[id] ?? id} art (out of sight)`, cmd: 'art' },
        { level: 'playing', label: () => `Play the ${GAMES[id] ?? id}`, cmd: 'play' },
    ]
    let waiting: Level | undefined
    const render = () => {
        root.style.display = level === 'playing' ? 'none' : ''
        root.replaceChildren()
        const title = document.createElement('div')
        title.className = 'title'
        title.textContent = 'The measuring ladder'
        const switcher = document.createElement('button')
        switcher.className = 'switch'
        switcher.textContent = `Game: ${GAMES[id] ?? id} (switch)`
        switcher.onclick = () => {
            id = id === 'daily-wheel' ? 'daily-scratcher' : 'daily-wheel'
            render()
        }
        root.append(title, switcher)
        const at = LEVELS.indexOf(level)
        const artFor = game?.id
        const page = document.createElement('button')
        page.className = 'step done'
        page.disabled = true
        page.textContent = '✓ The frame page'
        root.append(page)
        for (const step of steps) {
            const button = document.createElement('button')
            const done = LEVELS.indexOf(step.level) <= at && (step.level !== 'art' || artFor === id)
            button.className = `step${done ? ' done' : ''}`
            button.disabled = done || waiting !== undefined
            button.textContent = `${done ? '✓ ' : waiting === step.level ? '… ' : ''}${step.label()}`
            button.onclick = () => {
                waiting = step.level
                render()
                run({ cmd: step.cmd, game: id, tier })
                void queue.then(() => {
                    waiting = undefined
                    render()
                })
            }
            root.append(button)
        }
    }
    render()
    return { render }
}

mark('shell-ready')
reach('shell')
const start = params.get('stage')
if (start === 'code' || start === 'engine') run({ cmd: start })
