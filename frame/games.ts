// Everything a game needs (PixiJS, the particles, the sound engine and its AudioContext), in its
// own chunk: main.ts loads it on the ladder's `code` step (or a later one), so what the code costs
// can be told apart from the page.
import { PIXI, sound } from '@betty-mini-games/test-liveops-sdk'

import { forgetCutFrames } from '../src/shared/view/sheetTexture'

export { DailyWheelGame } from '../src/games/daily-wheel/DailyWheelGame'
export { DailyScratcherGame } from '../src/games/daily-scratcher/DailyScratcherGame'
export { assetsUrl as wheelBase } from '../src/games/daily-wheel'
export { assetsUrl as scratcherBase } from '../src/games/daily-scratcher'

/**
 * Everything the open game asked PixiJS to load (aliases and URLs). Every load goes through
 * `PIXI.Assets.load`: the SDK's asset lists and the win screen's lockup lights. The sounds are not
 * here: each game destroys its own when it closes.
 */
const loaded = new Set<string>()

type LoadInput = Parameters<typeof PIXI.Assets.load>[0]

function keysOf(input: LoadInput): string[] {
    const items = (Array.isArray(input) ? input : [input]) as unknown[]
    return items.flatMap((item) => {
        if (typeof item === 'string') return [item]
        if (item && typeof item === 'object') {
            const { alias, src } = item as { alias?: string | string[]; src?: unknown }
            if (alias !== undefined) return ([] as string[]).concat(alias)
            if (typeof src === 'string') return [src]
        }
        return []
    })
}

/**
 * PixiJS decodes the art into ImageBitmaps and never closes them: a destroyed texture's bitmap (the
 * whole decoded image) stays in memory until the garbage collector happens to run, which it does
 * not hurry to do, since it does not see that memory. Closed with the texture, it goes at once.
 */
const destroySource = PIXI.TextureSource.prototype.destroy
PIXI.TextureSource.prototype.destroy = function (this: PIXI.TextureSource): void {
    const resource: unknown = this.resource
    destroySource.call(this)
    if (typeof ImageBitmap !== 'undefined' && resource instanceof ImageBitmap) resource.close()
}

/**
 * PixiJS updates a video's texture with `texSubImage2D`, and for a video Chromium (Chrome, Android's
 * WebView) then keeps a copy of every frame in its image cache: memory that is not the page's, so it
 * is not freed when the game closes, nor when the frame is removed while it shares the host's process.
 * The whole-texture update below (`texImage2D`, the same pixels) does not keep those copies.
 */
for (const Context of [WebGLRenderingContext, WebGL2RenderingContext]) {
    const subImage = Context.prototype.texSubImage2D as (...args: unknown[]) => void
    Context.prototype.texSubImage2D = function (this: WebGLRenderingContext, ...args: unknown[]): void {
        const [target, level, x, y, format, type, source] = args
        if (args.length === 7 && x === 0 && y === 0 && source instanceof HTMLVideoElement) {
            this.texImage2D(target as GLenum, level as GLint, format as GLint, format as GLenum, type as GLenum, source)
            return
        }
        subImage.apply(this, args)
    } as typeof Context.prototype.texSubImage2D
}

/**
 * The games' videos (the wheel's backdrop), held while a game waits out of sight (the ladder's
 * `art` step): a video playing there would decode and upload frames nobody sees.
 */
const videos = new Set<HTMLVideoElement>()
let holding = false
const playMedia = HTMLMediaElement.prototype.play
HTMLMediaElement.prototype.play = function (this: HTMLMediaElement): Promise<void> {
    if (this instanceof HTMLVideoElement) {
        videos.add(this)
        if (holding) return Promise.resolve()
    }
    return playMedia.call(this)
}

/** Holds the videos (paused, and not started), or lets them play again. */
export function holdVideos(hold: boolean): void {
    holding = hold
    for (const video of videos) {
        // Let go by its game (no source): forgotten.
        if (!video.getAttribute('src') && !video.currentSrc) {
            videos.delete(video)
            continue
        }
        if (hold) video.pause()
        else void playMedia.call(video).catch(() => {})
    }
}

const load = PIXI.Assets.load.bind(PIXI.Assets)
PIXI.Assets.load = ((input: LoadInput, onProgress?: Parameters<typeof load>[1]) => {
    keysOf(input).forEach((key) => loaded.add(key))
    return load(input, onProgress)
}) as unknown as typeof PIXI.Assets.load

/**
 * Unloads the closed game's art (its textures, decoded images and GPU uploads), so memory goes back
 * to about the lobby's level after every game. The next open loads it again, from the browser's
 * cache. `?keepArt=1` on the frame's address keeps it instead (faster opens, more memory).
 */
export async function releaseArt(): Promise<void> {
    const keys = [...loaded]
    loaded.clear()
    videos.clear()
    forgetCutFrames()
    if (!keys.length) return
    try {
        await PIXI.Assets.unload(keys)
    } catch (error) {
        console.warn('[daily-games] the closed game\'s art could not all be released', error)
    }
}

/**
 * The `engine` step of the measuring ladder: a PixiJS app made and drawn once, with no art, so the
 * WebGL context, its drawing buffers and the first shaders exist before any game is opened. Made
 * with the games' own options. Its ticker is stopped: nothing draws while it waits.
 */
let warm: PIXI.Application | undefined
let warming: Promise<void> | undefined

export function warmEngine(): Promise<void> {
    warming ??= (async () => {
        const app = new PIXI.Application()
        await app.init({
            resizeTo: window,
            resolution: Math.min(window.devicePixelRatio || 1, 2),
            autoDensity: true,
            backgroundAlpha: 0,
            antialias: true,
        })
        app.ticker.stop()
        // In the page like a game's canvas, but never seen or touched.
        app.canvas.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none'
        document.body.appendChild(app.canvas)
        // A sprite and a shape: the batcher's and the graphics' shaders compile, as on a game's first draw.
        app.stage.addChild(new PIXI.Sprite(PIXI.Texture.WHITE), new PIXI.Graphics().rect(0, 0, 1, 1).fill(0xffffff))
        app.render()
        warm = app
    })()
    return warming
}

/**
 * Lets the warm engine go, right before a game makes its own: one WebGL context at a time, as in
 * a real host. (The SDK's Game makes its own PixiJS app; reusing the warm one would mean changing it.)
 */
export async function dropEngine(): Promise<void> {
    if (!warming) return
    await warming.catch(() => {})
    warm?.destroy({ removeView: true }, { children: true })
    warm = undefined
    warming = undefined
}

/** A WebGL context let go now, rather than whenever its canvas is collected (the GPU memory with it). */
export function loseContext(app: PIXI.Application | undefined): void {
    const gl = (app?.renderer as { gl?: WebGLRenderingContext } | undefined)?.gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
}

/** The page going (`pagehide`), nothing awaited: the warm engine's GPU memory goes at once. */
export function loseEngineContext(): void {
    loseContext(warm)
}

/**
 * Everything the games' code holds, let go before the host removes the frame: the art (textures,
 * their GPU copies and decoded bitmaps), the warm engine (its WebGL context) and the sound engine
 * (its AudioContext). The games cannot be played after this: the host removes the page next.
 */
export async function teardown(): Promise<void> {
    await releaseArt()
    await dropEngine()
    try {
        sound.removeAll()
        sound.close()
    } catch (error) {
        console.warn('[daily-games] the sound engine could not be closed', error)
    }
}
