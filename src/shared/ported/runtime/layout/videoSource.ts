import { isAppleTouchDevice } from '../shell/appleTouch';
import type { AssetSource } from './assetSource';

/**
 * One video file: the value `require('./clip.mp4')` gives, or a URL.
 *
 * Metro hands native code a module number and webpack hands the browser a URL
 * string, so the one `require` in a skin serves both.
 */
export type BackdropVideoFile = AssetSource;

/**
 * Where a video layer plays, for picking a file per target.
 *
 * `webkit` is Safari and every browser on iPhone and iPad, which all run Apple's
 * engine; `web` is every other browser. They are split because the two engines
 * honour transparency in different formats while both claim to play either, so
 * the browser cannot be left to choose between `<source>` elements.
 */
export type VideoTarget = 'ios' | 'android' | 'webkit' | 'web';

/**
 * One file for every target, or a file per target.
 *
 * A target without a file skips the layer, which leaves the board's poster, or
 * its colour, underneath. `webkit` falls back to `web`, since most files play
 * the same in both.
 */
export type BackdropVideoSource =
  | BackdropVideoFile
  | (Partial<Record<VideoTarget, BackdropVideoFile>> & {
      /**
       * The `web` cut again as H.264, which the `web` target plays instead
       * where the browser would decode VP9 in software and H.264 in hardware:
       * software decode of a looping backdrop takes a large share of a core
       * the page draws on. Only for a cut with no transparency, which H.264
       * cannot carry.
       */
      webH264?: BackdropVideoFile;
    });

/**
 * A backdrop cut twice: tall for a phone and square for everything wider.
 * Each covers the frame, cropped to it about its centre.
 */
export type BackdropVideoVariants = {
  portrait: BackdropVideoSource;
  square: BackdropVideoSource;
  /**
   * The portrait cut's composition's width and height in pixels, where it
   * is not 1080 x 1920: the whole picture's shape, which decides the frames
   * that play it, not a cropped file's (see `crop`).
   */
  portraitSize?: readonly [number, number];
  /**
   * Where each cut's files sit in the composition the cut was made for, when
   * they hold only some of its rows and the game draws the rest over the
   * board (a tier's floor). The files, and the cut's still, are placed as
   * that whole composition would be, so the two stay registered.
   */
  crop?: { portrait?: VideoCrop; square?: VideoCrop };
};

/** The rows of a composition a cut's files hold: see `crop`. */
export type VideoCrop = {
  /** The whole composition, in pixels: what covers the frame. */
  frame: readonly [number, number];
  /** The first row the files hold, and how many, in the composition's pixels. */
  top: number;
  height: number;
};

export type BackdropVideo = BackdropVideoSource | BackdropVideoVariants;

/**
 * A still of the backdrop video's first frame, kept under it: one for every
 * frame, or each cut's own, so a frame always shows the still of the cut it
 * plays.
 */
export type BackdropPoster =
  | AssetSource
  | { portrait: AssetSource; square: AssetSource };

/**
 * The widest frame, as width over height, that plays the portrait cut: the
 * cut's own shape, 1080 x 1920. Up to it the cut covers the frame by its
 * height, as the wheel is fitted, so the scene stays registered with the
 * wheel; any wider and it would cover by its width, grow past the wheel and
 * crop the plinth out from under the rim. The square cut covers every frame
 * from there to a square by its height. A phone is about 0.46 to 0.56, the
 * latter a 16:9 one, but a phone browser's window, short of its toolbars, is
 * often wider, as are a tablet and the desktop popup.
 */
export const PORTRAIT_MAX_ASPECT = 1080 / 1920;

function hasVariants(video: BackdropVideo): video is BackdropVideoVariants {
  return typeof video === 'object' && 'portrait' in video && 'square' in video;
}

function portraitMaxAspect({ portraitSize }: BackdropVideoVariants): number {
  if (!portraitSize) return PORTRAIT_MAX_ASPECT;
  const [width, height] = portraitSize;
  return height > 0 ? width / height : PORTRAIT_MAX_ASPECT;
}

function portraitFits(
  frameWidth: number,
  frameHeight: number,
  maxAspect: number,
): boolean {
  return frameHeight > 0 && frameWidth / frameHeight <= maxAspect;
}

/**
 * Which of a backdrop's two cuts a frame plays: see `PORTRAIT_MAX_ASPECT`.
 * Without a video in two cuts to follow, the portrait one goes to a frame no
 * wider than 1080 x 1920. Every pick here follows it, as does whatever a
 * game draws in a cut's own pixels, so the two always agree.
 */
export function pickBackdropCut(
  video: BackdropVideo | undefined,
  frameWidth: number,
  frameHeight: number,
): 'portrait' | 'square' {
  const maxAspect =
    video !== undefined && hasVariants(video)
      ? portraitMaxAspect(video)
      : PORTRAIT_MAX_ASPECT;
  return portraitFits(frameWidth, frameHeight, maxAspect)
    ? 'portrait'
    : 'square';
}

/** The cut a frame plays: see `pickBackdropCut`. */
export function pickBackdropVariant(
  video: BackdropVideo,
  frameWidth: number,
  frameHeight: number,
): BackdropVideoSource {
  if (!hasVariants(video)) return video;
  return video[pickBackdropCut(video, frameWidth, frameHeight)];
}

/** The crop of the cut a frame plays, if its files hold only some of its rows. */
export function pickBackdropCrop(
  video: BackdropVideo | undefined,
  frameWidth: number,
  frameHeight: number,
): VideoCrop | undefined {
  if (video === undefined || !hasVariants(video) || !video.crop)
    return undefined;
  return video.crop[pickBackdropCut(video, frameWidth, frameHeight)];
}

/**
 * The still a frame shows under its video: the one of the cut
 * `pickBackdropCut` picks there.
 */
export function pickBackdropPoster(
  poster: BackdropPoster,
  video: BackdropVideo | undefined,
  frameWidth: number,
  frameHeight: number,
): AssetSource {
  if (typeof poster !== 'object') return poster;
  return poster[pickBackdropCut(video, frameWidth, frameHeight)];
}

/** Every file a backdrop names, over its cuts and targets. */
export function videoFiles(video: BackdropVideo): BackdropVideoFile[] {
  const cuts = hasVariants(video) ? [video.portrait, video.square] : [video];
  return cuts.flatMap((cut) =>
    typeof cut === 'object'
      ? Object.values(cut).filter(
          (file): file is BackdropVideoFile => file !== undefined,
        )
      : [cut],
  );
}

/**
 * The file a target should play, or undefined when it should not draw the
 * layer. `preferH264` is `browserPrefersH264`'s answer, for the `web` target.
 */
export function pickVideoFile(
  source: BackdropVideoSource,
  target: VideoTarget,
  preferH264 = false,
): BackdropVideoFile | undefined {
  if (typeof source !== 'object') return source;
  if (target === 'webkit') return source.webkit ?? source.web;
  if (target === 'web' && preferH264) return source.webH264 ?? source.web;
  return source[target];
}

/**
 * Whether the file a target plays turns on `browserPrefersH264`'s answer, so
 * picking it has to wait for one.
 */
export function waitsForCodec(
  source: BackdropVideoSource,
  target: VideoTarget,
): boolean {
  return (
    target === 'web' &&
    typeof source === 'object' &&
    source.webH264 !== undefined
  );
}

/**
 * What a backdrop video element plays, given `browserPrefersH264`'s answer so
 * far: nothing yet while its file turns on an answer not yet in (`choosing`),
 * and otherwise the file `pickVideoFile` picks, at once for a source whose
 * file does not turn on the codec.
 */
export function backdropFileChoice(
  source: BackdropVideoSource,
  target: VideoTarget,
  preferH264: boolean | undefined,
): { choosing: boolean; file: BackdropVideoFile | undefined } {
  if (waitsForCodec(source, target) && preferH264 === undefined) {
    return { choosing: true, file: undefined };
  }
  return {
    choosing: false,
    file: pickVideoFile(source, target, preferH264 ?? false),
  };
}

/**
 * Whether the page is running in Apple's browser engine: every browser on
 * iPhone and iPad is WebKit underneath, whatever it calls itself.
 */
export function isWebKitBrowser(
  userAgent: string,
  platform = '',
  maxTouchPoints = 0,
): boolean {
  if (isAppleTouchDevice(userAgent, platform, maxTouchPoints)) return true;
  return (
    /AppleWebKit/.test(userAgent) &&
    !/Chrome|Chromium|Edg|OPR|Firefox/.test(userAgent)
  );
}

/** Where a browser plays a video: see `VideoTarget`. */
export function browserVideoTarget(): 'webkit' | 'web' {
  return typeof navigator !== 'undefined' &&
    isWebKitBrowser(
      navigator.userAgent,
      navigator.platform,
      navigator.maxTouchPoints,
    )
    ? 'webkit'
    : 'web';
}
