import { placeBox } from '../../../shared/ported/runtime';
import type {
  BoardBox,
  BoardFit,
  PlacedBox,
} from '../../../shared/ported/runtime';
import { buttonPlateCentre } from './buttonPlace';
import type { CardButtonPlace } from './cardButtonPlace';
import type {
  ScratcherSkin,
  ScratcherSlotName,
  ScratcherStillName,
} from './skins';

const ABSOLUTE = { position: 'absolute' } as const;

/** Her UI kit's px a board point: its @3x reference, button-tokens.json's `unit`. */
const KIT_PX = 3;

/** A still's style: its place, absolutely. */
export type PlacedStyle = [typeof ABSOLUTE, PlacedBox];

/** The card's stills, each placed as its skin's element: its shadow, its face and the title. */
export type CardStillName = Exclude<ScratcherStillName, 'nowin' | 'nowinagain'>;

/** The card's stills, in the order the screen draws them from the bottom up. */
export const CARD_STILLS: readonly CardStillName[] = [
  'cardshadow',
  'card',
  'titlegame',
];

/** Where everything the screen draws by a box sits, in screen points. */
export type ScreenArt = {
  stills: Readonly<Record<CardStillName, PlacedStyle>>;
  trays: { winning: PlacedBox; yours: PlacedBox };
  /** The TOP PRIZE plate, baked into the card: what a screen reader reads it as. */
  topPrize: PlacedBox;
  /**
   * Where the universal button draws QUICK SCRATCH and COLLECT: its middle
   * by her button rule on the board's centre line, the layout scale her px
   * are drawn at (a third of the board's) and the frame's width it is
   * centred across.
   */
  button: CardButtonPlace;
  noWin: Readonly<Record<'nowin' | 'nowinagain', PlacedStyle>>;
};

/** The insets of the frame a status bar, a rounded corner or a fold covers, points. */
export type SafeArea = {
  readonly top?: number;
  readonly left?: number;
  readonly right?: number;
};

/**
 * The top row's box on `fit`: the board's own, or, on a frame fitting the
 * skin's wide-screen band, whose board runs off the frame's top, across the
 * frame `wide.top` points down and `wide.height` tall, so its buttons sit
 * in the frame's corners: inside `safe`, so none sits under a status bar
 * there, as the iPhone Duo's open inner display has at its trailing edge.
 */
export function topRowBox(
  fit: BoardFit,
  slot: BoardBox,
  wide: { top: number; height: number } | undefined,
  safe: SafeArea = {},
): PlacedBox {
  if (!fit.band || !wide) return placeBox(fit, slot);
  const left = Math.max(0, safe.left ?? 0);
  const right = Math.max(0, safe.right ?? 0);
  return {
    left,
    top: Math.max(wide.top, safe.top ?? 0),
    width: Math.max(0, fit.frameWidth - left - right),
    height: wide.height,
  };
}

/** Where everything draws on `fit`, every box the skin's. */
export function placeScreenArt(fit: BoardFit, skin: ScratcherSkin): ScreenArt {
  const at = (name: ScratcherStillName | ScratcherSlotName): PlacedBox =>
    placeBox(fit, skin.elements[name]);
  const styled = (box: PlacedBox): PlacedStyle => [ABSOLUTE, box];
  const stills = {} as Record<CardStillName, PlacedStyle>;
  for (const name of CARD_STILLS) stills[name] = styled(at(name));
  // Her button rule: the pill's middle on the board's centre line, on every
  // fit. A skin's glow is laid round the pill as the button lays it out:
  // see `ButtonGlow`.
  const scale = fit.k / KIT_PX;
  const middle = placeBox(fit, {
    centre: [
      skin.board[0] / 2,
      buttonPlateCentre(fit.k, skin.buttons.place, skin.board[1]),
    ],
    size: [0, 0],
  });
  const button: CardButtonPlace = {
    centre: { x: middle.left, y: middle.top },
    scale,
    span: fit.frameWidth,
  };
  return {
    stills,
    trays: { winning: at('traywinning'), yours: at('trayyours') },
    topPrize: at('topprize'),
    button,
    noWin: { nowin: styled(at('nowin')), nowinagain: styled(at('nowinagain')) },
  };
}
