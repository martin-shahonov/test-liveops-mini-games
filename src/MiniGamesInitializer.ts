import type { MiniGame } from "./MiniGame"

export class MiniGamesInitializer {
    protected _miniGames: MiniGame[] = []

    constructor(protected fetchGamesData: () => Promise<void>) {
        this.init()
    }

    protected async init() {
        const result = await this.fetchGamesData()
    }
}
