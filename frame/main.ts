// The daily games frame, as simple as it gets, for measuring what the iframe (web) and the
// WebView (app) cost. No staging, preloading, origin checks or envelope: the host sends
// `{ "game": "daily-wheel" | "daily-scratcher", "tier"?: string }`, the game plays with its mock
// rewards, and the page answers `closed` when the player is done.
//
// Opened on its own: /frame/?game=daily-wheel (or daily-scratcher) plays that game at once.
type Games = typeof import('./games')
type Game = InstanceType<Games['DailyWheelGame']> | InstanceType<Games['DailyScratcherGame']>
type Open = { game: string; tier?: string }
type RNWindow = Window & { ReactNativeWebView?: { postMessage(data: string): void } }

/**
 * The games' code (PixiJS, the particles, the sound engine), loaded on the first open rather than
 * with the page: hidden in the lobby, the frame then holds only this listener. Kept after that.
 */
let games: Promise<Games> | undefined
const loadGames = (): Promise<Games> => (games ??= import('./games'))

/** The game on screen, or 'loading' while its code arrives. */
let current: Game | 'loading' | undefined

/** `?keepArt=1`: keep a closed game's art for the next open, instead of releasing it. */
const keepArt = new URLSearchParams(location.search).has('keepArt')
/** The last game's art being released: the next open waits for it, so it does not load what is being unloaded. */
let releasing: Promise<void> = Promise.resolve()

/** The host hides the frame on this: the app's WebView, or the page around the iframe. */
function tellClosed(): void {
    const rn = (window as RNWindow).ReactNativeWebView
    if (rn) rn.postMessage('closed')
    else window.parent.postMessage('closed', '*')
}

async function play({ game, tier }: Open): Promise<void> {
    if (current) return
    current = 'loading'
    let code: Games
    try {
        code = await loadGames()
        await releasing
    } catch (error) {
        // Not loaded (offline, say): no game, and the host must not keep an empty frame over the app.
        console.error('[daily-games] the games did not load', error)
        games = undefined
        current = undefined
        tellClosed()
        return
    }
    const container = document.createElement('div')
    container.className = 'game'
    document.body.appendChild(container)

    const onClose = () => {
        if (current !== instance) return
        current = undefined
        instance.destroy()
        // After the game's teardown (it runs once destroy() is called): its canvas, then its art.
        releasing = new Promise((done) =>
            setTimeout(() => {
                container.remove()
                ;(keepArt ? Promise.resolve() : code.releaseArt()).then(done, done)
            }, 0),
        )
        tellClosed()
    }
    const instance =
        game === 'daily-scratcher'
            ? new code.DailyScratcherGame({ base: code.scratcherBase, placement: 'daily', container, onClose })
            : new code.DailyWheelGame({ base: code.wheelBase, loyaltyTier: tier, container, onClose })
    current = instance
    instance.start().then(
        // What it draws with, for the inspector: webgl normally; canvas would mean no WebGL (slow).
        () => console.info(`[daily-games] ${game} on ${(instance.app.renderer as { name?: string }).name ?? '?'}`),
        (error: unknown) => {
            // It could not start (its art did not load, say): it closes, so the host hides the frame
            // instead of leaving an empty, transparent one over the app that takes every touch.
            console.error(`[daily-games] ${game} could not start`, error)
            onClose()
        },
    )
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
    if (message && typeof message === 'object' && typeof (message as Open).game === 'string') void play(message as Open)
}

window.addEventListener('message', (event) => receive(event.data))
// react-native-webview delivers on `document` on Android.
document.addEventListener('message', (event) => receive((event as MessageEvent).data))

const params = new URLSearchParams(location.search)
const direct = params.get('game')
if (direct) void play({ game: direct, tier: params.get('tier') ?? undefined })
