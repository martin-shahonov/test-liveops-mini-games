import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/** Libraries the SDK owns and re-exports: games import them from the SDK, so there is one copy of each. */
const SDK_OWNED = ['pixi.js', 'gsap', '@pixi/sound', 'nixie-fx']
const SDK_OWNED_PATTERNS = ['pixi.js/*', 'gsap/*', '@pixi/*', '@esotericsoftware/*', 'nixie-fx/*']
const MESSAGE = 'Import it from @betty-mini-games/test-liveops-sdk (PIXI, gsap, Spine, sound, Vfx): the SDK owns one copy for every game.'

export default tseslint.config(
    { ignores: ['dist', 'node_modules', 'public'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    prettier,
    {
        languageOptions: {
            globals: globals.browser,
        },
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    paths: SDK_OWNED.map((name) => ({ name, message: MESSAGE })),
                    patterns: [{ group: SDK_OWNED_PATTERNS, message: MESSAGE }],
                },
            ],
        },
    },
)
