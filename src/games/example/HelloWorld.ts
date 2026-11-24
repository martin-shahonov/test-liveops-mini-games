import { GameObject, gsap, PIXI, type Spine } from '@betty-mini-games/test-liveops-sdk'

/** Spineboy walking under a "Hello World" title. Tap him to make him jump. */
export class HelloWorld extends GameObject {
    protected _spineboy: Spine
    protected _title: PIXI.Text

    constructor() {
        super()

        // Spine: `createSpine` builds the skeleton from the loaded `example/spineboy-skel` / `example/spineboy-atlas` assets
        this._spineboy = this.createSpine('example/spineboy')
        this._spineboy.scale.set(0.5)
        this._spineboy.y = 150 // a skeleton's origin is at its feet
        this._spineboy.state.setAnimation(0, 'walk', true)
        this._spineboy.eventMode = 'static'
        this._spineboy.cursor = 'pointer'
        this._spineboy.on('pointertap', this.jump, this)

        // PixiJS: plain text
        this._title = new PIXI.Text({
            text: 'Hello World',
            style: { fill: '#ffffff', fontFamily: 'system-ui, sans-serif', fontSize: 72, fontWeight: '800' },
        })
        this._title.anchor.set(0.5)
        this._title.y = -220

        this.addChild(this._spineboy, this._title)

        // GSAP: pop the title in, then float it up and down forever
        gsap.from(this._title.scale, { x: 0, y: 0, duration: 0.8, ease: 'back.out(2)' })
        gsap.to(this._title, { y: '-=16', duration: 1.2, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 0.8 })
    }

    override destroy(): void {
        gsap.killTweensOf([this._title, this._title.scale])

        super.destroy()
    }

    protected jump(): void {
        this._spineboy.state.setAnimation(0, 'jump', false)
        this._spineboy.state.addAnimation(0, 'walk', true, 0)
    }
}
