import { GameError, type WheelReward, type WheelSector } from '../../../shared/ported/engine'

/** The guide's wheel (MiniGames' `GUIDE_WHEEL`, the UK API's GET /Players/{id}/wheel example). */
export const MOCK_SECTORS: WheelSector[] = (
    [
        [301, 20000, true],
        [302, 50, false],
        [303, 1000, false],
        [304, 200, false],
        [305, 700, false],
        [306, 5000, false],
        [307, 300, false],
        [308, 20, false],
        [309, 500, false],
        [310, 100, false],
    ] as const
).map(([id, winAmount, isSpecialSector]) => ({ id, winAmount, targetType: 'Coins' as const, isSpecialSector }))

/**
 * Which prize the mock awards (`?result=` on the dev page, the mock host's preset):
 * - `random`: mostly small, sometimes big, now and then the jackpot;
 * - `nice`, `mega`, `jackpot`: a prize of that win tier;
 * - `sector-<id>`: that sector's prize, wherever it lies on the wheel;
 * - `off-wheel`: a prize on no sector.
 */
export type MockResult = 'random' | 'nice' | 'mega' | 'jackpot' | 'off-wheel' | `sector-${number}`

/**
 * How the mock answers the claim (`?claim=`):
 * - `ok`: with the prize;
 * - `unavailable`, `offline`: nothing awarded, or the claim never sent: Spin is offered again;
 * - `connection-lost`, `unconfirmed`: the claim may have gone through: the wheel locks;
 * - `timeout`: no answer, until the wheel's 15 s pass; `late`: the answer after them.
 */
export type MockClaim = 'ok' | 'unavailable' | 'offline' | 'connection-lost' | 'unconfirmed' | 'timeout' | 'late'

/** The dev page's older single preset (`?scenario=`): a result or a claim. */
export type MockScenario = 'win' | Exclude<MockResult, 'random' | `sector-${number}`> | Exclude<MockClaim, 'ok'>

export type MockOptions = { result?: MockResult; claim?: MockClaim; answerMs?: number }

/** `?scenario=` as a result and a claim. */
export function fromScenario(scenario: MockScenario | undefined): MockOptions {
    if (scenario === undefined || scenario === 'win') return {}
    if (scenario === 'nice' || scenario === 'mega' || scenario === 'jackpot' || scenario === 'off-wheel') return { result: scenario }
    return { claim: scenario }
}

/** Where the wheel gets its sectors and its rewards from: the host, or the mock below. */
export interface WheelBackend {
    sectors(): Promise<readonly WheelSector[]>
    getReward(): Promise<WheelReward>
}

const WEIGHTS = [1, 14, 6, 14, 8, 3, 12, 14, 10, 18]
const ANSWER_MS = 600

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** The mock: the guide's sectors, and rewards as its options say. Nothing is paid. */
export class MockWheelBackend implements WheelBackend {
    protected _options: Required<MockOptions>

    constructor(
        options: MockOptions = {},
        protected _sectors: readonly WheelSector[] = MOCK_SECTORS,
    ) {
        this._options = { result: 'random', claim: 'ok', answerMs: ANSWER_MS, ...options }
    }

    async sectors(): Promise<readonly WheelSector[]> {
        return this._sectors
    }

    /** The prize the result names. */
    protected prize(): WheelReward {
        const sectors = this._sectors
        const pick = (sector: WheelSector): WheelReward => ({ ...sector, balance: 0 })
        const byAmount = (test: (amount: number) => boolean) => sectors.filter((s) => test(s.winAmount))
        const top = Math.max(...sectors.map((s) => s.winAmount))
        const result = this._options.result
        if (result.startsWith('sector-')) {
            const id = Number(result.slice('sector-'.length))
            const sector = sectors.find((s) => s.id === id)
            if (sector) return pick(sector)
            console.warn(`[daily-wheel] the mock has no sector ${id}: a random prize instead`)
        }
        switch (result) {
            case 'jackpot':
                return pick(sectors.find((s) => s.winAmount === top)!)
            case 'mega': {
                const mega = byAmount((a) => a >= 1000 && a < top)
                return pick(mega[Math.floor(Math.random() * mega.length)] ?? sectors[0]!)
            }
            case 'nice': {
                const nice = byAmount((a) => a < 1000)
                return pick(nice[Math.floor(Math.random() * nice.length)] ?? sectors[0]!)
            }
            case 'off-wheel':
                return { id: 999, winAmount: 750, targetType: 'Coins', isSpecialSector: false, balance: 0 }
            default: {
                const weights = sectors.map((_, i) => WEIGHTS[i % WEIGHTS.length]!)
                let roll = Math.random() * weights.reduce((a, b) => a + b, 0)
                let index = 0
                while (roll > weights[index]! && index < sectors.length - 1) {
                    roll -= weights[index]!
                    index += 1
                }
                return pick(sectors[index]!)
            }
        }
    }

    async getReward(): Promise<WheelReward> {
        const { claim, answerMs } = this._options
        switch (claim) {
            case 'offline':
                throw new GameError('reward-offline', 'The device is offline')
            case 'timeout':
                return new Promise<WheelReward>(() => {})
            case 'late':
                await wait(17_000)
                return this.prize()
        }
        await wait(answerMs)
        switch (claim) {
            case 'unavailable':
                throw new GameError('reward-unavailable', 'No prize was awarded')
            case 'connection-lost':
                throw new GameError('reward-connection-lost', 'The connection dropped before the answer')
            case 'unconfirmed':
                throw new Error('500: the server could not say')
        }
        return this.prize()
    }
}
