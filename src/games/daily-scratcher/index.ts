import { DailyScratcherGame } from './DailyScratcherGame'
import { fromScenario, type MockClaim, type MockOutcome, type MockScenario } from './backend/mockBackend'
import type { ScratcherPlacement } from './ported/DailyScratcherScreen.types'
import { devFlag, devNumber, devParam } from '../../shared/devParams'

/** This game's static files: public/test-liveops-assets/daily-scratcher/ (the test-liveops-assets repo, served as is next to the library's build). */
export const assetsUrl = `${import.meta.env.BASE_URL}test-liveops-assets/daily-scratcher/`

/**
 * Entry point of the game. On the dev page, the mock host's presets: `?outcome=` the win
 * the mock deals, `?cells=9|12`, `?tokens=1`, `?seed=` which card, `?claim=` how the claim
 * is answered and `?answerMs=` how fast (see `backend/mockBackend.ts`), `?placement=` where
 * the card came from, and the shared ones (`shared/devParams.ts`). The older `?scenario=`
 * still works.
 */
export function createGame(): DailyScratcherGame {
    const outcome = devParam('outcome') as MockOutcome | undefined
    const claim = devParam('claim') as MockClaim | undefined
    const cells = devNumber('cells')
    return new DailyScratcherGame({
        base: assetsUrl,
        skin: devParam('skin'),
        mock: {
            ...fromScenario(devParam('scenario') as MockScenario | undefined),
            ...(outcome ? { outcome } : {}),
            ...(claim ? { claim } : {}),
            ...(cells === 12 || cells === 9 ? { cells } : {}),
            ...(devParam('tokens') !== undefined ? { tokens: devFlag('tokens') } : {}),
            ...(devNumber('answerMs') !== undefined ? { answerMs: devNumber('answerMs') } : {}),
            ...(devNumber('seed') !== undefined ? { seed: devNumber('seed') } : {}),
        },
        placement: (devParam('placement') as ScratcherPlacement | undefined) ?? 'daily',
        debug: devParam('debug') !== undefined,
        bare: devParam('bare') !== undefined,
    })
}
