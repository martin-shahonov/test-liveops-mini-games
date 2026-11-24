import { DI, Game, type GameConfig } from '@betty-mini-games/test-liveops-sdk'

import { CollectionsIdleStateAction } from './states/CollectionsIdleStateAction'

/** Swaps the SDK's abstract state actions for this game's own ones (only `idle` is used so far). */
class CollectionsDI extends DI {
    protected override registerStateActionsCtors(): void {
        super.registerStateActionsCtors()

        this._bottle.value('idleStateActionCtor', CollectionsIdleStateAction)
    }
}

/** The game: the SDK's Game, wired with this game's DI. */
export class CollectionsGame extends Game {
    constructor(config: GameConfig) {
        super(config)

        this._di = new CollectionsDI(config)
    }
}
