import type {
  DailyScratcherLabels,
  DailyScratcherLabelsInput,
} from './DailyScratcherScreen.types';

/**
 * The English every string falls back to. `title` reads what the title
 * block shows; `noMatch` and `noMatchAgain` end a card with no match, the
 * words the no-win plates bake where a skin shows them;
 * `howToPlaySteps` are How To Play's three steps, drawn in its drawer as
 * written; `matchHint` is the YOUR SYMBOLS tray's hint, the design having
 * no instruction line. A screen reader hears them. The symbols' names are
 * what their art shows.
 */
export const DEFAULT_LABELS: Readonly<DailyScratcherLabels> = {
  title: 'Betty Scratcher',
  quickScratch: 'Quick Scratch',
  collect: 'Collect',
  howToPlay: 'How to play',
  soundOn: 'Turn sound on',
  soundOff: 'Turn sound off',
  howToPlaySteps: [
    'Scratch the card manually\nor tap Quick Scratch',
    'Match a winning symbol\nto one of yours',
    'Win the prize\nunder your match',
  ],
  okay: 'Okay',
  noMatch: 'No match this time. Come back tomorrow!',
  noMatchAgain: 'No match this time. Better luck next time!',
  failed: 'Something went wrong. Try again.',
  unavailable: 'We could not confirm this prize. Please check your balance.',
  jackpot: 'MAX WIN!',
  mega: 'MEGA WIN!',
  nice: 'NICE WIN!',
  close: 'Close',
  loading: 'Loading the Daily Scratcher',
  winningSymbols: 'Winning symbols',
  yourSymbols: 'Your symbols',
  covered: 'covered',
  matched: 'Matched',
  tokens: 'tokens',
  symbols: {
    coin: 'Betty coin',
    crown: 'crown',
    heart: 'heart',
    clover: 'four-leaf clover',
    star: 'star',
    diamond: 'diamond',
  },
  topPrize: 'Top prize',
  matchHint:
    'Match any of the winning symbols to any of your symbols to win a prize!',
  noConnection: 'No connection',
  noConnectionDetail: 'Check your internet and try again.',
  retry: 'Retry',
  connectionLost: 'Connection lost',
  connectionLostDetail:
    'Don\u2019t worry, your prize is safe.\nWe\u2019ll show it when you\u2019re back online.',
  reconnect: 'Reconnect',
  somethingWentWrong: 'Something went wrong',
  somethingWentWrongDetail: 'Please try again in a moment.',
  tryAgain: 'Try again',
  prizeNotConfirmed: 'Prize not confirmed',
  prizeNotConfirmedDetail:
    'We could not confirm this prize.\nPlease check your balance.',
};

const KEYS = Object.keys(DEFAULT_LABELS) as (keyof DailyScratcherLabels)[];

/**
 * The host's strings over the defaults, one at a time, the symbols' names
 * one by one. `Partial` lets a key be present but undefined, which a
 * spread would copy over its default.
 */
export function withDefaultLabels(
  labels: DailyScratcherLabelsInput | undefined,
): DailyScratcherLabels {
  const text = { ...DEFAULT_LABELS, symbols: { ...DEFAULT_LABELS.symbols } };
  for (const key of KEYS) {
    if (key === 'symbols') continue;
    const given = labels?.[key];
    if (given !== undefined) (text as Record<string, unknown>)[key] = given;
  }
  for (const id of Object.keys(DEFAULT_LABELS.symbols) as Array<
    keyof typeof DEFAULT_LABELS.symbols
  >) {
    const given = labels?.symbols?.[id];
    if (given !== undefined) text.symbols[id] = given;
  }
  return text;
}
