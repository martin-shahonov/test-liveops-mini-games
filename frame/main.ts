// The daily games frame, as simple as it gets, for measuring what the iframe (web) and the
// WebView (app) cost. No staging, preloading, origin checks or envelope: the host sends
// `{ "game": "daily-wheel" | "daily-scratcher", "tier"?: string }`, the game plays with its mock
// rewards, and the page answers `closed` when the player is done.
//
// Opened on its own: /frame/?game=daily-wheel (or daily-scratcher) plays that game at once.
import { DailyWheelGame } from '../src/games/daily-wheel/DailyWheelGame'
import { DailyScratcherGame } from '../src/games/daily-scratcher/DailyScratcherGame'
import { assetsUrl as wheelBase } from '../src/games/daily-wheel'
import { assetsUrl as scratcherBase } from '../src/games/daily-scratcher'

type Open = { game: string; tier?: string }
type RNWindow = Window & { ReactNativeWebView?: { postMessage(data: string): void } }

let open: DailyWheelGame | DailyScratcherGame | undefined

function play({ game, tier }: Open): void {
    if (open) return
    const container = document.createElement('div')
    container.className = 'game'
    document.body.appendChild(container)

    const onClose = () => {
        if (open !== instance) return
        open = undefined
        instance.destroy()
        setTimeout(() => container.remove(), 0)
        const rn = (window as RNWindow).ReactNativeWebView
        if (rn) rn.postMessage('closed')
        else window.parent.postMessage('closed', '*')
    }
    const instance =
        game === 'daily-scratcher'
            ? new DailyScratcherGame({ base: scratcherBase, placement: 'daily', container, onClose })
            : new DailyWheelGame({ base: wheelBase, loyaltyTier: tier, container, onClose })
    open = instance
    void instance.start()
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
    if (message && typeof message === 'object' && typeof (message as Open).game === 'string') play(message as Open)
}

window.addEventListener('message', (event) => receive(event.data))
// react-native-webview delivers on `document` on Android.
document.addEventListener('message', (event) => receive((event as MessageEvent).data))

const params = new URLSearchParams(location.search)
const direct = params.get('game')
if (direct) play({ game: direct, tier: params.get('tier') ?? undefined })
