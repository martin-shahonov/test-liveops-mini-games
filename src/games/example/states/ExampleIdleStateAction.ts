import { IdleStateAction } from '@betty-mini-games/test-liveops-sdk'

/**
 * The SDK's state actions are abstract: every game implements `onEnter()` for the states it goes through.
 * The machine enters `idle` as soon as the game is created; Hello World has nothing to do there.
 * A real game would call `this.complete()` here once it is ready to move on to `init`.
 */
export class ExampleIdleStateAction extends IdleStateAction {
    protected override onEnter(): void {}
}
