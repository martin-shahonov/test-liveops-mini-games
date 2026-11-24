import type { VideoTarget } from './videoSource';

/** What a browser says about decoding one kind of video. */
export type VideoDecoding = { supported: boolean; powerEfficient: boolean };

/**
 * The backdrop's WebM and MP4 as a browser is asked about them: VP9 profile 0
 * and H.264 High, both at level 4, the level the larger cut, 1080 x 1920 at
 * 30 fps, needs, and near the cuts' own bitrates. The answer stands for the
 * square cut too: its MP4 is labelled level 5.1, but 1080 x 1080 at 30 fps
 * is well within level 4's limits.
 */
const BACKDROP_VP9 = {
  contentType: 'video/webm; codecs="vp09.00.40.08"',
  width: 1080,
  height: 1920,
  bitrate: 1_100_000,
  framerate: 30,
};
const BACKDROP_H264 = {
  ...BACKDROP_VP9,
  contentType: 'video/mp4; codecs="avc1.640028"',
  bitrate: 850_000,
};

/**
 * How long a browser gets to answer before the WebM is kept: the backdrop
 * waits on the answer, and it is usually in within a few milliseconds.
 */
export const VIDEO_PROBE_MS = 150;

/**
 * Whether to play H.264 rather than VP9: only where VP9 would decode in
 * software and H.264 in hardware. A browser that decodes VP9 in hardware
 * keeps the WebM, and one that decodes both in software gains nothing.
 */
export function prefersH264(vp9: VideoDecoding, h264: VideoDecoding): boolean {
  return !vp9.powerEfficient && h264.supported && h264.powerEfficient;
}

/**
 * Asks the browser how it would decode the backdrop in each codec. Resolves
 * false, which keeps the WebM, where it cannot say or does not within
 * `VIDEO_PROBE_MS`; never rejects.
 */
export function probePrefersH264(
  capabilities: MediaCapabilities | undefined,
): Promise<boolean> {
  if (typeof capabilities?.decodingInfo !== 'function') {
    return Promise.resolve(false);
  }
  const ask = (video: VideoConfiguration) =>
    capabilities.decodingInfo({ type: 'file', video });
  const answer = Promise.all([ask(BACKDROP_VP9), ask(BACKDROP_H264)]).then(
    ([vp9, h264]) => prefersH264(vp9, h264),
    () => false,
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ceiling = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), VIDEO_PROBE_MS);
  });
  return Promise.race([answer, ceiling]).finally(() => clearTimeout(timer));
}

let probed: Promise<boolean> | undefined;
let known: boolean | undefined;

/**
 * `probePrefersH264` for this browser, asked once, so the prefetch and the
 * video element pick the same file.
 */
export function browserPrefersH264(): Promise<boolean> {
  probed ??= probePrefersH264(
    typeof navigator !== 'undefined' ? navigator.mediaCapabilities : undefined,
  ).then((prefers) => {
    known = prefers;
    return prefers;
  });
  return probed;
}

/** The answer `browserPrefersH264` gives, once it has one. */
export function browserPrefersH264Now(): boolean | undefined {
  return known;
}

/**
 * Asks `browserPrefersH264` ahead of any backdrop, so the answer is almost
 * always in by the time one mounts and it picks its file at once. Only the
 * `web` target asks: WebKit plays its own file whatever the answer.
 */
export function askVideoCodecEarly(target: VideoTarget): void {
  if (target === 'web') void browserPrefersH264();
}

/**
 * Calls `answer` with `browserPrefersH264`'s answer once it is in, unless the
 * function it returns has been called first: an element that has unmounted,
 * or run its effect again, is not told.
 */
export function whenPrefersH264(
  answer: (prefers: boolean) => void,
): () => void {
  let wanted = true;
  void browserPrefersH264().then((prefers) => {
    if (wanted) answer(prefers);
  });
  return () => {
    wanted = false;
  };
}
