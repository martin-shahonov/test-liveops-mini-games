import { IdleStateAction } from '@betty-mini-games/test-liveops-sdk'

/** Before the card is drawn: the SDK's controller moves on once it is. */
export class DailyScratcherIdleState extends IdleStateAction {
    protected override onEnter(): void {}
}
