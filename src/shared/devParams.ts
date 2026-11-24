/**
 * What the dev page's address presets for a game: the mock host's preset panel writes
 * them (see mini-games-mock-host/src/presets.ts). Each is read once, as the game starts.
 * A host-launched game reads none of them: the library is handed its settings instead.
 */
const params = () => new URLSearchParams(typeof location === 'undefined' ? '' : location.search)

/** A preset by its name, or undefined. */
export function devParam(name: string): string | undefined {
    return params().get(name) ?? undefined
}

/** A number preset, or undefined for none or one that is not a number. */
export function devNumber(name: string): number | undefined {
    const value = devParam(name)
    if (value === undefined || value === '') return undefined
    const number = Number(value)
    return Number.isFinite(number) ? number : undefined
}

/** A switch preset: present and not `0` or `false`. */
export function devFlag(name: string): boolean {
    const value = devParam(name)
    return value !== undefined && value !== '0' && value !== 'false'
}

/** Reduce Motion, as `?reduceMotion=1` presets it, or as the OS asks. */
export function prefersReducedMotion(): boolean {
    const value = devParam('reduceMotion')
    if (value !== undefined) return devFlag('reduceMotion')
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** The game starts with its sound off (`?muted=1`), as a host that kept the player's choice would start it. */
export function startsMuted(): boolean {
    return devFlag('muted')
}

/** How long the mock takes to answer a claim, ms (`?answerMs=`), or `fallback`. */
export function answerMs(fallback: number): number {
    return devNumber('answerMs') ?? fallback
}
