import { rmSync } from 'node:fs'
import { defineConfig } from 'vite'

/**
 * The libraries the SDK owns. Games reach them only through `@betty-mini-games/test-liveops-sdk`
 * (see eslint.config.js); `dedupe` keeps one copy of each in the bundle. Two pixi.js copies
 * would not recognise each other's objects.
 */
const SDK_OWNED = ['pixi.js', 'gsap', '@pixi/sound', '@esotericsoftware/spine-pixi-v8', 'nixie-fx']

export default defineConfig({
    resolve: { dedupe: SDK_OWNED },
    plugins: [
        {
            // public/test-liveops-assets is its own git repo: Vite copies its .git into dist with the
            // art. Its pack file is over Cloudflare Pages' 25 MiB limit, and the history has no place on a CDN.
            name: 'drop-assets-git',
            apply: 'build',
            closeBundle() {
                rmSync('dist/test-liveops-assets/.git', { recursive: true, force: true })
            },
        },
    ],
    // `npm run dev:frame` (the frame on /frame/, the dev page on /dev/) and `npm run preview:frame`
    // (the built frame) answer any address: a phone reaches them as http://<the Mac's name>.local
    // or its IP, which Vite would otherwise refuse.
    server: { allowedHosts: true },
    preview: { cors: true, allowedHosts: true },
    build: {
        // `npm run build:frame`: the frame as a static site (dist/frame/index.html, the bundles, public/ with the art).
        outDir: 'dist',
        emptyOutDir: true,
        target: 'es2022',
        rollupOptions: { input: { frame: 'frame/index.html' } },
    },
})
