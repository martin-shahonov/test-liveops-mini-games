import { DailyWheelGame } from './DailyWheelGame'
import { fromScenario, type MockClaim, type MockResult, type MockScenario } from './backend/mockBackend'
import { devParam, devNumber } from '../../shared/devParams'

/** This game's static files: public/test-liveops-assets/daily-wheel/ (the test-liveops-assets repo, served as is next to the library's build). */
export const assetsUrl = `${import.meta.env.BASE_URL}test-liveops-assets/daily-wheel/`

/**
 * Entry point of the game. On the dev page, the mock host's presets: `?tier=` the loyalty
 * tier's skin (`Member` ... `Vip`, Ruby when left out, Member for one with no art),
 * `?result=` the prize the mock awards, `?claim=` how it answers, `?answerMs=` how fast
 * (see `backend/mockBackend.ts`), and the shared ones (`shared/devParams.ts`). The older
 * `?scenario=` still works.
 */
export function createGame(): DailyWheelGame {
    const result = devParam('result') as MockResult | undefined
    const claim = devParam('claim') as MockClaim | undefined
    return new DailyWheelGame({
        base: assetsUrl,
        loyaltyTier: devParam('tier') ?? 'Ruby',
        mock: {
            ...fromScenario(devParam('scenario') as MockScenario | undefined),
            ...(result ? { result } : {}),
            ...(claim ? { claim } : {}),
            ...(devNumber('answerMs') !== undefined ? { answerMs: devNumber('answerMs') } : {}),
        },
        debug: devParam('debug') !== undefined,
    })
}
