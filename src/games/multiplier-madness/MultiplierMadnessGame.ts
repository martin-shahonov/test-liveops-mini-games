import { DI, Game, type GameConfig } from '@betty-mini-games/test-liveops-sdk'

import { MultiplierMadnessIdleStateAction } from './states/MultiplierMadnessIdleStateAction'

/** Swaps the SDK's abstract state actions for this game's own ones (only `idle` is used so far). */
class MultiplierMadnessDI extends DI {
    protected override registerStateActionsCtors(): void {
        super.registerStateActionsCtors()

        this._bottle.value('idleStateActionCtor', MultiplierMadnessIdleStateAction)
    }
}

/** The game: the SDK's Game, wired with this game's DI. */
export class MultiplierMadnessGame extends Game {
    constructor(config: GameConfig) {
        super(config)

        this._di = new MultiplierMadnessDI(config)
    }
}
