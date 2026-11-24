import { GameObject, gsap, lifecycle, LifecycleEvents, PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { BackdropVideo } from '../ported/runtime/layout/videoSource'
import type { BoardFit, PlacedBox } from '../ported/runtime/layout/fit'

/** Where the backdrop goes: its cut, its still and its box (the poster and the video share it). */
export type BackdropPlace = { backdrop: { cut: 'portrait' | 'square'; poster?: string; box: PlacedBox | null }; fit: BoardFit }
import { fill, texture } from './util'
import { browserVideoTarget, pickBackdropVariant, pickVideoFile } from '../ported/runtime/layout/videoSource'
import { browserPrefersH264Now } from '../ported/runtime/layout/videoCodec'

/** MiniGames' `BACKDROP_FADE_MS`: the video fades in over its still once it plays. */
const BACKDROP_FADE_MS = 250

/**
 * The board's backdrop (MiniGames' `Board`): the still of the cut the frame plays,
 * and the looping video over it, faded in once its first frame is up. Where the video
 * cannot play (an iPhone in Low Power Mode, say) the still stays.
 */
export class Backdrop extends GameObject {
    protected _poster = new PIXI.Sprite()
    protected _video = new PIXI.Sprite()
    protected _element?: HTMLVideoElement
    protected _url?: string
    protected _playing = false
    protected _offs: Array<() => void> = []

    constructor(protected _skin: { backdropVideo?: BackdropVideo }) {
        super()
        this._video.alpha = 0
        this.addChild(this._poster, this._video)
        const pause = () => this._element?.pause()
        const resume = () => void this._element?.play().catch(() => {})
        lifecycle.on(LifecycleEvents.pause, pause)
        lifecycle.on(LifecycleEvents.resume, resume)
        this._offs.push(() => {
            lifecycle.off(LifecycleEvents.pause, pause)
            lifecycle.off(LifecycleEvents.resume, resume)
        })
    }

    layout({ backdrop, fit }: BackdropPlace): void {
        const { box, poster } = backdrop
        if (poster) {
            this._poster.texture = texture(poster)
        }
        fill(this._poster, box)
        fill(this._video, box)
        this.playCut(fit.frameWidth, fit.frameHeight)
    }

    override destroy(): void {
        this._offs.forEach((off) => off())
        this.dropVideo()
        super.destroy()
    }

    /** The cut's file for this browser, played muted and looped into a texture. */
    protected playCut(width: number, height: number): void {
        const video = this._skin.backdropVideo
        if (!video) {
            return
        }
        const source = pickBackdropVariant(video, width, height)
        const url = pickVideoFile(source, browserVideoTarget(), browserPrefersH264Now() ?? false)
        if (typeof url !== 'string' || url === this._url) {
            return
        }
        this.dropVideo()
        this._url = url

        const element = document.createElement('video')
        element.src = url
        element.muted = true
        element.defaultMuted = true
        element.setAttribute('muted', '')
        element.loop = true
        element.playsInline = true
        element.setAttribute('playsinline', '')
        element.preload = 'auto'
        element.crossOrigin = 'anonymous'
        this._element = element

        let data = false
        let playing = false
        const shown = () => {
            if (!data || !playing || this._playing || this._element !== element) {
                return
            }
            this._playing = true
            this._video.texture = PIXI.Texture.from(element)
            gsap.to(this._video, { alpha: 1, duration: BACKDROP_FADE_MS / 1000, ease: 'sine.inOut' })
        }
        element.addEventListener('loadeddata', () => ((data = true), shown()))
        element.addEventListener('playing', () => ((playing = true), shown()))
        element.play().catch(() => {
            // Play refused: the still stays.
        })
    }

    protected dropVideo(): void {
        const element = this._element
        if (!element) {
            return
        }
        gsap.killTweensOf(this._video)
        this._video.alpha = 0
        this._video.texture = PIXI.Texture.EMPTY
        this._playing = false
        element.pause()
        element.removeAttribute('src')
        element.load()
        this._element = undefined
        this._url = undefined
    }
}
