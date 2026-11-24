/** The universal button's word face (MiniGames' runtime `UI_LABEL_FONT`): Inter Black, under the runtime's own name. */
export const UI_LABEL_FONT = 'MiniGamesInter-Black'

/** The drawers' faces (How To Play, the popups). */
export const DRAWER_FONTS = {
    serif: 'MiniGamesDrawer-DMSerifText',
    regular: 'MiniGamesDrawer-Inter',
    medium: 'MiniGamesDrawer-InterMedium',
} as const

/** Registers the game's faces from its assets folder and waits for them (Pixi's Text needs a face loaded to measure it). */
export async function loadFonts(base: string): Promise<void> {
    const faces: [string, string][] = [
        [UI_LABEL_FONT, 'ui/fonts/interblack.woff2'],
        [DRAWER_FONTS.serif, 'ui/fonts/drawer-dmseriftext.woff2'],
        [DRAWER_FONTS.regular, 'ui/fonts/drawer-inter-regular.woff2'],
        [DRAWER_FONTS.medium, 'ui/fonts/drawer-inter-medium.woff2'],
    ]
    await Promise.all(
        faces.map(async ([family, file]) => {
            try {
                const face = new FontFace(family, `url(${base}${file})`)
                document.fonts.add(await face.load())
            } catch (error) {
                console.warn(`[daily-wheel] the ${family} face could not be loaded`, error)
            }
        }),
    )
}
