import { ResolvingStateAction } from '@betty-mini-games/test-liveops-sdk'

/** The outcome is known and shown: nothing to wait for between the scratch and the win. */
export class DailyScratcherResolvingState extends ResolvingStateAction {
    protected override onEnter(): void {
        this.complete()
    }
}
