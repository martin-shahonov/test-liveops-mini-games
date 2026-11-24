import { DI, Game, type GameConfig } from '@betty-mini-games/test-liveops-sdk'

import { StreaksIdleStateAction } from './states/StreaksIdleStateAction'

/** Swaps the SDK's abstract state actions for this game's own ones (only `idle` is used so far). */
class StreaksDI extends DI {
    protected override registerStateActionsCtors(): void {
        super.registerStateActionsCtors()

        this._bottle.value('idleStateActionCtor', StreaksIdleStateAction)
    }
}

/** The game: the SDK's Game, wired with this game's DI. */
export class StreaksGame extends Game {
    constructor(config: GameConfig) {
        super(config)

        this._di = new StreaksDI(config)
    }
}
