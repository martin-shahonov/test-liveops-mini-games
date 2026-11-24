import { DI, Game, type GameConfig } from '@betty-mini-games/test-liveops-sdk'

import { ExampleIdleStateAction } from './states/ExampleIdleStateAction'

/** Swaps the SDK's abstract state actions for this game's own ones (only `idle` is used in Hello World). */
class ExampleDI extends DI {
    protected override registerStateActionsCtors(): void {
        super.registerStateActionsCtors()

        this._bottle.value('idleStateActionCtor', ExampleIdleStateAction)
    }
}

/** The game: the SDK's Game, wired with this game's DI. */
export class ExampleGame extends Game {
    constructor(config: GameConfig) {
        super(config)

        this._di = new ExampleDI(config)
    }
}
