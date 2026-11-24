/** Every `@/...` path in an exported skin, as a URL under `base` (the game's assets folder, ending in `/`). */
export function resolvePaths<T>(value: T, base: string): T {
    if (typeof value === 'string') {
        return (value.startsWith('@/') ? `${base}${value.slice(2)}` : value) as T
    }
    if (Array.isArray(value)) {
        return value.map((item) => resolvePaths(item, base)) as T
    }
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {}
        for (const [key, item] of Object.entries(value)) {
            out[key] = resolvePaths(item, base)
        }
        return out as T
    }
    return value
}

/** A skin exported to `<base>skins/<id>.json`, its paths resolved. */
export async function fetchSkin<T>(base: string, id: string): Promise<T> {
    const raw = (await (await fetch(`${base}skins/${id}.json`)).json()) as T
    return resolvePaths(raw, base)
}
