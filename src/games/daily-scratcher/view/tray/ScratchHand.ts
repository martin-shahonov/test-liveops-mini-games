import { GameObject, PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { PlacedBox } from '../../../../shared/ported/runtime'
import { texture } from '../../../../shared/view/util'
import { drawnAlpha, shadowPlace, type CoinFrame, type CoinOpen } from '../../ported/tray/coinMotion'
import { coinTableOf, coinXform, drawnPose, frameRegion, type CoinTable, type DrawnPose } from '../../ported/tray/coinSheet'
import { cellBox, type FlakeShape } from '../../ported/tray/flakeAtlas'
import { FLAKE_STRIDE, type FlakePlan } from '../../ported/tray/flakes'
import type { ScratchTray } from './ScratchTray'

/** A soft black disc, for the contact shadow's blurred oval: drawn once, scaled to each frame. */
function softDisc(size = 64): PIXI.Texture {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const g = canvas.getContext('2d')!
    const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(0,0,0,1)')
    gradient.addColorStop(0.55, 'rgba(0,0,0,0.85)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gradient
    g.fillRect(0, 0, size, size)
    return PIXI.Texture.from(canvas, true)
}

/** MiniGames' `drawFlakeAtlas`: every flake's white shape in its own cell, to be tinted per flake. */
function flakeAtlas(plan: FlakePlan): { texture: PIXI.Texture; cells: PIXI.Texture[] } {
    const { layout, shapes } = plan
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, layout.width)
    canvas.height = Math.max(1, layout.height)
    const g = canvas.getContext('2d')!
    g.fillStyle = 'white'
    const unit = layout.unitPx
    shapes.forEach((shape: FlakeShape, index) => {
        const [left, top, size] = cellBox(layout, index)
        const cx = left + size / 2
        const cy = top + size / 2
        g.beginPath()
        if (shape.kind === 'ellipse') {
            g.ellipse(cx + shape.x * unit, cy + shape.y * unit, shape.rx * unit, shape.ry * unit, 0, 0, Math.PI * 2)
        } else {
            const { points } = shape
            for (let i = 0; i + 1 < points.length; i += 2) {
                const x = cx + points[i]! * unit
                const y = cy + points[i + 1]! * unit
                if (i === 0) g.moveTo(x, y)
                else g.lineTo(x, y)
            }
            g.closePath()
        }
        g.fill()
    })
    const atlas = PIXI.Texture.from(canvas, true)
    const cells: PIXI.Texture[] = []
    for (let i = 0; i < layout.count; i++) {
        const [x, y, w, h] = cellBox(layout, i)
        cells.push(new PIXI.Texture({ source: atlas.source, frame: new PIXI.Rectangle(x, y, w, h) }))
    }
    return { texture: atlas, cells }
}

/** One tray's coin: its contact shadow and the two frames of the sheet it blends. */
type HandCoin = { tray: ScratchTray; shadow: PIXI.Sprite; a: PIXI.Sprite; b: PIXI.Sprite; origin: { x: number; y: number } }

/**
 * MiniGames' `ScratchHand`: over both trays and as far round them as the coin reaches,
 * every tray's flakes under every tray's coin, each tray's coin from its sheet with its
 * contact shadow, all read each frame from what the trays write (`hand`, `flakes`). A coin
 * at rest is hidden while another tray's is in a finger (`drawnAlpha`). Its own layer, over
 * both trays and the top prize: the coin rises well above the finger.
 */
export class ScratchHand extends GameObject {
    protected _coins: HandCoin[]
    protected _flakeLayer = new PIXI.Container()
    protected _flakes: PIXI.Sprite[] = []
    protected _flakeCells: PIXI.Texture[] = []
    protected _table?: CoinTable
    protected _pose?: DrawnPose | null
    protected _frames: PIXI.Texture[] = []
    protected _shadow: ReturnType<typeof shadowPlace>

    constructor(
        protected _trays: readonly ScratchTray[],
        protected _coin: { sheet: string; table: string },
        protected _open: CoinOpen,
        flakes: FlakePlan,
    ) {
        super()
        this._shadow = shadowPlace(_open.shadow, _open.motion.coinH)
        const disc = softDisc()
        this.addChild(this._flakeLayer)
        this._coins = _trays.map((tray) => {
            const shadow = new PIXI.Sprite(disc)
            shadow.anchor.set(0.5)
            const a = new PIXI.Sprite()
            const b = new PIXI.Sprite()
            for (const sprite of [shadow, a, b]) sprite.visible = false
            this.addChild(shadow, a, b)
            return { tray, shadow, a, b, origin: { x: 0, y: 0 } }
        })
        if (flakes.slots > 0) this._flakeCells = flakeAtlas(flakes).cells
        void this.loadTable()
        PIXI.Ticker.shared.add(this.draw, this)
    }

    /** The coin's frame table: what the sheet's frames are cut by. */
    protected async loadTable(): Promise<void> {
        try {
            this._table = coinTableOf(await (await fetch(this._coin.table)).json())
        } catch (error) {
            console.warn('[daily-scratcher] the coin in the hand: its frame table did not load', error)
            return
        }
        const { pose, problem } = drawnPose(this._open.pose, this._table)
        if (problem) console.warn(`[daily-scratcher] the coin in the hand: ${problem}`)
        this._pose = pose
        const sheet = texture(this._coin.sheet)
        this._frames = Array.from({ length: this._table.count }, (_, i) => {
            const [x, y, w, h] = frameRegion(this._table!.frames, i)
            return new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(x, y, w, h) })
        })
    }

    /** Each tray's corner on the board, its board points scaled by `k` (the hand draws in board points). */
    layout(boxes: readonly PlacedBox[], k: number): void {
        this.scale.set(k)
        this._coins.forEach((coin, i) => {
            const box = boxes[i]!
            coin.origin = { x: box.left / k, y: box.top / k }
        })
    }

    override destroy(options?: PIXI.DestroyOptions): void {
        PIXI.Ticker.shared.remove(this.draw, this)
        // Cut from the coin sheet, which the assets cache keeps: the frames (not the sheet) go.
        this._frames.forEach((frame) => frame.destroy())
        super.destroy(options)
    }

    protected draw(): void {
        this.drawFlakes()
        const frames = this._coins.map((coin) => coin.tray.hand)
        this._coins.forEach((coin, i) => {
            const f = frames[i]!
            const others = frames.filter((_, j) => j !== i)
            this.drawCoin(coin, f, drawnAlpha(f, others))
        })
    }

    protected drawCoin(coin: HandCoin, f: CoinFrame, alpha: number): void {
        const { shadow, a, b, origin } = coin
        const table = this._table
        const pose = this._pose
        if (alpha <= 0 || !table || !pose) {
            shadow.visible = a.visible = b.visible = false
            return
        }
        // The contact shadow: an oval, turned, scaled with the lift and softened by it.
        const s = this._shadow
        shadow.visible = f.shadowAlpha > 0
        shadow.alpha = f.shadowAlpha
        shadow.position.set(origin.x + f.x + s.dx, origin.y + f.y + s.dy)
        shadow.rotation = s.angle
        const grow = 1 + (2 * f.shadowSigma) / Math.max(1e-3, Math.min(s.rx, s.ry) * f.shadowScale)
        shadow.width = 2 * s.rx * f.shadowScale * grow
        shadow.height = 2 * s.ry * f.shadowScale * grow

        // The coin: frame A at its alpha and frame B over it at its alpha times the blend.
        const turns = pose.turns
        const rest = pose.restFrame
        const fa = turns && f.frameA >= 0 ? f.frameA : rest
        const fb = turns && f.frameB >= 0 ? f.frameB : fa
        const unit = this._open.motion.coinH / pose.faceHeightPx
        const scale = f.scale * unit
        const x = origin.x + f.x
        const y = origin.y + f.y - f.rise
        const [px, py] = pose.contactPoint
        const at = [0, 0, 0, 0]
        const place = (sprite: PIXI.Sprite, index: number, spriteAlpha: number) => {
            const tex = this._frames[index]
            if (!tex || spriteAlpha <= 0) {
                sprite.visible = false
                return
            }
            sprite.visible = true
            sprite.texture = tex
            coinXform(table.frames, index, scale, f.rotation, x, y, px!, py!, at)
            // An RSXform [scos, ssin, tx, ty] as a matrix: x' = scos u - ssin v + tx, y' = ssin u + scos v + ty.
            sprite.setFromMatrix(new PIXI.Matrix(at[0]!, at[1]!, -at[1]!, at[0]!, at[2]!, at[3]!))
            sprite.alpha = spriteAlpha
        }
        place(a, fa, alpha)
        place(b, fb, turns && f.frameB >= 0 ? alpha * f.mix : 0)
    }

    /** MiniGames' `unpackFlakes`: each tray's packed sprites at its place, tinted. */
    protected drawFlakes(): void {
        let used = 0
        this._coins.forEach(({ tray, origin }) => {
            const frame = tray.flakes
            const count = Math.floor(frame.length / FLAKE_STRIDE)
            for (let s = 0; s < count; s++) {
                const f = s * FLAKE_STRIDE
                let sprite = this._flakes[used]
                if (!sprite) {
                    sprite = new PIXI.Sprite()
                    this._flakes.push(sprite)
                    this._flakeLayer.addChild(sprite)
                }
                used++
                const cell = this._flakeCells[frame[f + 4]!]
                if (!cell) {
                    sprite.visible = false
                    continue
                }
                sprite.visible = true
                sprite.texture = cell
                const scos = frame[f]!
                const ssin = frame[f + 1]!
                sprite.setFromMatrix(new PIXI.Matrix(scos, ssin, -ssin, scos, frame[f + 2]! + origin.x, frame[f + 3]! + origin.y))
                sprite.tint = (Math.round(frame[f + 5]! * 255) << 16) | (Math.round(frame[f + 6]! * 255) << 8) | Math.round(frame[f + 7]! * 255)
                sprite.alpha = frame[f + 8]!
            }
        })
        for (let i = used; i < this._flakes.length; i++) this._flakes[i]!.visible = false
    }
}
