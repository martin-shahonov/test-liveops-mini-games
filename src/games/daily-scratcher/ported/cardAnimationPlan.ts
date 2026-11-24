import type {
  BoardBox,
  BoardFit,
  PlacedBox,
} from '../../../shared/ported/runtime';
import type {
  SpriteSheet,
  SpriteTile,
  VfxTextureSource,
} from '../../../shared/ported/vfx';
import { fieldCore } from './cardLayout';
import type { ScreenPhase, ScreenState } from './screenState';
import type {
  ScratcherAnimationAnchor,
  ScratcherAnimationPlace,
  ScratcherAnimations,
  ScratcherSkin,
} from './skins/types';
import type { CellBox } from './tray';

/**
 * How the motion designer's card animations play, from his hand-off: every
 * sheet at 30 fps, one clock each. The text glow plays, waits `titleRestS`
 * and plays again; the fields' sweep, once the top prize's has played,
 * plays, waits `fieldsRestS` and plays again until the first scratch, when
 * it fades out over `fieldsOutMs`; the win's glows fade in and out over
 * `winFadeMs`, and the card's own come in over `inMs` as the button's glow
 * does (`GLOW_FADE_MS`), so the rim, which has no dark first frame, does
 * not pop on.
 */
export const CARD_ANIMATION_TIMING = {
  fps: 30,
  titleRestS: 5,
  fieldsRestS: 3,
  fieldsOutMs: 250,
  winFadeMs: 500,
  inMs: 250,
} as const;

/** The boxes the card's animations are laid on, in board points. */
export type AnimationAnchors = Readonly<
  Record<ScratcherAnimationAnchor, BoardBox>
>;

/** The box holding `a` and `b`. */
function unionOf(a: CellBox, b: CellBox): BoardBox {
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  const right = Math.max(a.left + a.width, b.left + b.width);
  const bottom = Math.max(a.top + a.height, b.top + b.height);
  return {
    centre: [(left + right) / 2, (top + bottom) / 2],
    size: [right - left, bottom - top],
  };
}

/**
 * What a skin's animations are laid on, from its own layout: the ticket's
 * plate, the BETTY SCRATCHER line, the TOP PRIZE plate and the two scratch
 * fields' cores together. A new layout moves them, and the animations with
 * them.
 */
export function animationAnchors(
  skin: Pick<ScratcherSkin, 'card' | 'elements' | 'coatings'> & {
    animations: Pick<ScratcherAnimations, 'titleLine'>;
  },
): AnimationAnchors {
  const winning = fieldCore(
    skin.elements.traywinning,
    skin.coatings.winning.field,
  ).box;
  const yours = fieldCore(
    skin.elements.trayyours,
    skin.coatings.yours.field,
  ).box;
  return {
    ticket: skin.card.plate,
    title: skin.animations.titleLine,
    topPrize: skin.elements.topprize,
    fields: unionOf(winning, yours),
  };
}

/** An animation's box on what it is laid on: `place` read in that box's width. */
export function animationBox(
  place: ScratcherAnimationPlace,
  anchors: AnimationAnchors,
): BoardBox {
  const { centre, size } = anchors[place.anchor];
  const width = size[0];
  return {
    centre: [
      centre[0] + place.offset[0] * width,
      centre[1] + place.offset[1] * width,
    ],
    size: [place.size[0] * width, place.size[1] * width],
  };
}

/** The card's own animations and the glow behind it, by name. */
export type CardAnimationName =
  | 'back'
  | 'rim'
  | 'title'
  | 'topPrize'
  | 'fields';

export const CARD_ANIMATION_NAMES: readonly CardAnimationName[] = [
  'back',
  'rim',
  'title',
  'topPrize',
  'fields',
];

/** Where each of the card's animations sits on the board, in board points. */
export function cardAnimationBoxes(
  skin: Pick<ScratcherSkin, 'card' | 'elements' | 'coatings'> & {
    animations: ScratcherAnimations;
  },
): Readonly<Record<CardAnimationName, BoardBox>> {
  const anchors = animationAnchors(skin);
  const boxes = {} as Record<CardAnimationName, BoardBox>;
  for (const name of CARD_ANIMATION_NAMES) {
    boxes[name] = animationBox(skin.animations[name].place, anchors);
  }
  return boxes;
}

/** A canvas and where a sheet's untrimmed canvas lands in it. */
export type FramedSequence = { box: PlacedBox; tile: SpriteTile };

/**
 * `box`, a sheet's whole untrimmed canvas on the screen, cut to the frame
 * the board is drawn in, with where that canvas lands in what is left: the
 * glow behind the ticket is more than twice the board's width, and what
 * the frame does not show needs no canvas.
 */
export function framedSequence(
  box: PlacedBox,
  frame: Pick<BoardFit, 'frameWidth' | 'frameHeight'>,
): FramedSequence {
  const left = Math.max(0, box.left);
  const top = Math.max(0, box.top);
  const right = Math.min(frame.frameWidth, box.left + box.width);
  const bottom = Math.min(frame.frameHeight, box.top + box.height);
  return {
    box: {
      left,
      top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
    },
    tile: {
      x: box.left - left,
      y: box.top - top,
      width: box.width,
      height: box.height,
    },
  };
}

/**
 * A tile glow's canvas on a lit tile, in the tile's units: centred on it,
 * `scale` times its height across and down, and stretched across to
 * `scale` times its width (`stretchX`), so a 12-cell card's narrow tile
 * takes it at its own aspect.
 */
export function tileAnimationBox(
  tile: CellBox,
  scale: number,
): { box: CellBox; stretchX: number } {
  const side = tile.height * scale;
  return {
    box: {
      left: tile.left + tile.width / 2 - side / 2,
      top: tile.top + tile.height / 2 - side / 2,
      width: side,
      height: side,
    },
    stretchX: tile.width / tile.height,
  };
}

/** Frames of `sheet` across `seconds`, at its own rate. */
const framesIn = (sheet: Pick<SpriteSheet, 'fps'>, seconds: number) =>
  Math.round(seconds * sheet.fps);

/**
 * `sheet` with `count` empty frames: what a canvas shows nothing through,
 * on the sequence's own clock, so a wait stands still with the frame it
 * follows when the sequence is frozen.
 */
function withEmptyFrames(
  sheet: SpriteSheet,
  keep: number,
  count: number,
): SpriteSheet {
  const stride = sheet.frames.length / sheet.count;
  // Any frame's numbers: an empty frame is never drawn.
  const blank = sheet.frames.slice(0, stride);
  return {
    ...sheet,
    frames: [
      ...sheet.frames.slice(0, keep * stride),
      ...Array.from({ length: count }, () => blank).flat(),
    ],
    pages: [...sheet.pages.slice(0, keep), ...Array<number>(count).fill(0)],
    empty: [...sheet.empty.slice(0, keep), ...Array<boolean>(count).fill(true)],
    count: keep + count,
  };
}

/** `sheet` played and then nothing for `seconds`: one round of a loop that waits between plays. */
export function thenRest(sheet: SpriteSheet, seconds: number): SpriteSheet {
  return withEmptyFrames(sheet, sheet.count, framesIn(sheet, seconds));
}

/** Nothing, from `sheet`'s page, for as long as `before` plays: a sequence's lead-in. */
export function restFor(sheet: SpriteSheet, before: SpriteSheet): SpriteSheet {
  return withEmptyFrames(
    sheet,
    0,
    Math.max(1, framesIn(sheet, before.count / before.fps)),
  );
}

/** How long one round of `clips` played back to back takes, ms. */
export const playMs = (clips: readonly SpriteSheet[]): number =>
  clips.reduce((sum, clip) => sum + (clip.count / clip.fps) * 1000, 0);

/**
 * What each of the card's own animations plays, back to back, its last
 * clip looping where it loops: the rim as he made it; the text glow and 5 s
 * of nothing; the top prize's once; and the fields' sweep, nothing for as
 * long as the top prize's plays, then the sweep and 3 s of nothing.
 */
export function cardAnimationClips(
  animations: Pick<
    ScratcherAnimations,
    'rim' | 'title' | 'topPrize' | 'fields'
  >,
): Readonly<Record<'rim' | 'title' | 'topPrize' | 'fields', SpriteSheet[]>> {
  const { titleRestS, fieldsRestS } = CARD_ANIMATION_TIMING;
  return {
    rim: [animations.rim.sheet],
    title: [thenRest(animations.title.sheet, titleRestS)],
    topPrize: [animations.topPrize.sheet],
    fields: [
      restFor(animations.fields.sheet, animations.topPrize.sheet),
      thenRest(animations.fields.sheet, fieldsRestS),
    ],
  };
}

/** The sheets every card draws its own animations from. */
export function cardAnimationSheets(
  skin: Pick<ScratcherSkin, 'animations'>,
): VfxTextureSource[] {
  const animations = skin.animations;
  if (!animations) return [];
  return [
    ...animations.rim.sheet.images,
    ...animations.title.sheet.images,
    ...animations.topPrize.sheet.images,
    ...animations.fields.sheet.images,
  ];
}

/** The sheets only a card with a match draws: the glow behind the ticket and the tile glows. */
export function winAnimationSheets(
  skin: Pick<ScratcherSkin, 'animations'>,
): VfxTextureSource[] {
  const animations = skin.animations;
  if (!animations) return [];
  return [
    ...animations.back.sheet.images,
    ...animations.tile.back.images,
    ...animations.tile.frameIn.images,
    ...animations.tile.frameIdle.images,
  ];
}

/** The phases a stroke or Quick Scratch takes an offered card to. */
const TAKEN: readonly ScreenPhase[] = ['scratching', 'sweeping'];

/**
 * Whether the card has been played: a stroke or Quick Scratch has taken it
 * from the offer, which asks for its claim. A card locked as it mounts, one
 * the rules cannot play, or one closed untouched, never was. A refused
 * claim offers it again, so the screen keeps the first time it was.
 */
export const cardPlayed = (
  state: Pick<ScreenState, 'phase' | 'claim'>,
): boolean => TAKEN.includes(state.phase) || state.claim !== 'none';

/** Whether the card has gone: closed, or its reward handed over. */
export const cardGone = (state: Pick<ScreenState, 'phase' | 'collect'>) =>
  state.phase === 'closed' || state.collect === 'done';

/** Whether a match is lit on the card: the moment the win's glows start. */
export const matchLit = (lit: ScreenState['lit']): boolean =>
  lit.winning.length + lit.yours.length > 0;
