import { IdleStateAction } from '@betty-mini-games/test-liveops-sdk'

/**
 * The machine enters `idle` as soon as the game is created. Nothing to do yet:
 * call `this.complete()` here once the game is ready to move on to `init`.
 */
export class StreaksIdleStateAction extends IdleStateAction {
    protected override onEnter(): void {}
}
