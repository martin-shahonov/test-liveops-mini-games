import { IdleStateAction } from '@betty-mini-games/test-liveops-sdk'

/** Entered as the game is created; the controller moves on once the board is drawn. */
export class DailyWheelIdleState extends IdleStateAction {
    protected override onEnter(): void {}
}
