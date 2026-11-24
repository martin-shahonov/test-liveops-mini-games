import { GameError } from '../../../shared/ported/engine'
import type { ScratcherCard, ScratcherReward } from '../ported/rules'
import { scratcherOutcome } from '../ported/rules'

/** What the mock deals (`?outcome=` on the dev page, the mock host's preset): a card with that win, or none. */
export type MockOutcome = 'random' | 'nice' | 'mega' | 'max' | 'nowin'

/**
 * How the mock answers the claim (`?claim=`): with the card's outcome (`ok`); refused with
 * nothing awarded (`unavailable`, `offline`: the card is offered again); lost or failed
 * (`connection-lost`, `unconfirmed`: the card locks); or never (`timeout`).
 */
export type MockClaim = 'ok' | 'unavailable' | 'offline' | 'connection-lost' | 'unconfirmed' | 'timeout'

export type MockOptions = {
    outcome?: MockOutcome
    /** 9 cells, 3 by 3, or 12, 4 by 3. */
    cells?: 9 | 12
    /** One match pays tokens. */
    tokens?: boolean
    claim?: MockClaim
    answerMs?: number
    /** The same seed deals the same card. */
    seed?: number
}

/** The dev page's older single preset (`?scenario=`). */
export type MockScenario = 'win' | 'nice' | 'mega' | 'max' | 'nowin' | 'tokens' | 'twelve' | Exclude<MockClaim, 'ok' | 'timeout'>

/** `?scenario=` as the options it stood for. */
export function fromScenario(scenario: MockScenario | undefined): MockOptions {
    switch (scenario) {
        case undefined:
        case 'win':
            return {}
        case 'nice':
        case 'mega':
        case 'max':
        case 'nowin':
            return { outcome: scenario }
        case 'tokens':
            return { outcome: 'mega', tokens: true }
        case 'twelve':
            return { cells: 12 }
        default:
            return { claim: scenario }
    }
}

/** Where the card comes from and where its claim goes: the host, or the mock. */
export interface ScratcherBackend {
    card(): Promise<ScratcherCard>
    claim(card: ScratcherCard): Promise<ScratcherReward>
}

const SYMBOLS = ['coin', 'crown', 'heart', 'clover', 'star', 'diamond']
const AMOUNTS = [100, 250, 500, 1000, 2500, 5000, 10000]
const TOP_PRIZE = 50000

/** A seeded generator, so a scenario deals the same card every time (`?seed=`). */
function seeded(seed: number): () => number {
    let s = seed >>> 0 || 1
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0
        return s / 2 ** 32
    }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * The frame demo's mock host (`apps/frame/src/mock.ts`): three winning symbols and nine
 * cells, the claim answered after 500 ms with the card's own outcome.
 */
export class MockScratcherBackend implements ScratcherBackend {
    protected _random: () => number
    protected _options: Required<Omit<MockOptions, 'seed'>>

    constructor(options: MockOptions = {}) {
        this._random = seeded(options.seed ?? 7)
        this._options = { outcome: 'random', cells: 9, tokens: false, claim: 'ok', answerMs: 500, ...options }
    }

    async card(): Promise<ScratcherCard> {
        const random = this._random
        const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!
        const shuffled = [...SYMBOLS].sort(() => random() - 0.5)
        const winning = shuffled.slice(0, 3)
        const others = shuffled.slice(3)
        const { outcome, tokens: paysTokens } = this._options
        const count = this._options.cells
        const matches =
            outcome === 'nowin' ? 0 : outcome === 'max' ? 3 : outcome === 'mega' ? 2 : outcome === 'nice' ? 1 : 1 + Math.floor(random() * 3)
        const matched = new Set<number>()
        while (matched.size < matches) matched.add(Math.floor(random() * count))
        const prizeOf = (i: number) => {
            if (outcome === 'max') return TOP_PRIZE
            if (outcome === 'mega') return 10000
            if (outcome === 'nice') return 250
            return pick(i < 0 ? AMOUNTS : [...AMOUNTS, TOP_PRIZE])
        }
        let n = 0
        return {
            id: Math.floor(random() * 1e9),
            winning,
            cells: Array.from({ length: count }, (_, index) => {
                if (!matched.has(index)) return { symbol: pick(others), prize: { rewardType: 'Coins' as const, amount: pick(AMOUNTS) } }
                n += 1
                const tokens = paysTokens && n === Math.min(2, matches)
                return {
                    symbol: pick(winning),
                    prize: { rewardType: tokens ? ('Tokens' as const) : ('Coins' as const), amount: tokens ? 25 : prizeOf(index) },
                }
            }),
            columns: count === 12 ? 4 : 3,
            topPrize: { rewardType: 'Coins', amount: TOP_PRIZE },
        }
    }

    async claim(card: ScratcherCard): Promise<ScratcherReward> {
        const { claim, answerMs } = this._options
        if (claim === 'offline') throw new GameError('reward-offline', 'The mock is offline')
        if (claim === 'timeout') return new Promise<ScratcherReward>(() => {})
        await wait(answerMs)
        switch (claim) {
            case 'unavailable':
                throw new GameError('reward-unavailable', 'The mock has no reward for this card')
            case 'connection-lost':
                throw new GameError('reward-connection-lost', 'The mock lost the answer')
            case 'unconfirmed':
                throw new GameError('reward-unconfirmed', 'The mock failed the claim')
        }
        return { ...scratcherOutcome(card), cardId: card.id }
    }
}
