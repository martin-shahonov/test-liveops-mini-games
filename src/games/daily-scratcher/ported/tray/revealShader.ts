import { cutOf, type ScratchField } from './field';
import { MASK_REACH } from './mask';

/**
 * The reveal, drawn in one pass: a runtime shader over the coating that
 * reads what the finger has scratched from the mask (see `mask.ts`) and
 * turns it into the cut:
 *
 * - soft: the scratched area blurred by `sigma`, read off the distance
 *   field as the normal curve's integral, `phi(-d / sigma)`;
 * - the ragged edge: in the band where soft is neither 0 nor 1,
 *   `4 soft (1 - soft)`, the edge is pushed in and out by the static grit,
 *   and the result sharpened six times about one half;
 * - clipped to the field shrunk by its inset: the coating's core, inset 0,
 *   so the rim scratches off with the coating and the soft shadow outside
 *   it stays;
 * - the coating keeps `1 - reveal` of itself, lit by the lip outside the
 *   cut's lower-right side, and the hole shows what is under the canvas,
 *   darkened by the wall's shadow along the cut's upper-left side and lit
 *   by the wall along the lower-right one.
 *
 * It draws the look `REVEAL` names: Rossen's from the Coin Lean Lab
 * (`REVEAL_LAB`), or the designer's from SPEC-scratch-animation section 3
 * (`REVEAL_SPEC`), each a plain object of every number it draws by.
 *
 * Its children, in the order the scene gives them: the coating, the mask
 * (an alpha image, a texel a point) and the grit (an alpha image tiled at
 * the designer's 3 px a point: her two noises, fine and coarse, already
 * weighted and summed, see art/render/grit.mjs). Every value it reads from
 * the mask and the grit is alpha, which no colour management touches.
 *
 * Each child is read with a cubic, 16 texels a read, so a pixel reads only
 * what can change it: the grit only where it can move the cut, the coating
 * only where some of it shows, the hole up and left of the coating only
 * where the lip outside it can reach, and the wall and the lip not at all
 * deep inside the hole, where neither reaches.
 */

/** A look for the cut: every number the shader draws it by. */
export type RevealLook = {
  /** The soft edge's blur, board points. */
  sigma: number;
  /** How far the wall's shadow falls, down and right, board points. */
  wall: number;
  /** How softly the shadow ends where it falls, board points. */
  wallSigma: number;
  /** How dark the shadow gets at most. */
  wallDark: number;
  /**
   * Whether the shadow and the lit wall run up to the cut, as the lab
   * draws its bands, the cut's own soft edge fading them with the hole;
   * or are blurred as wholes, as the designer's are, softening them there
   * too.
   */
  bandsToCut: boolean;
  /** How far up and left the lit wall reads its edge from, board points: its width. */
  lip: number;
  /** How strong the lit wall is, and the lip outside the cut. */
  lipStrength: number;
  /** How sharply the lit wall and the lip read the cut's edge: the cut's own is 6. */
  lipSharpen: number;
  /** The lit wall's blur, board points, which softens the field's edge for it too. */
  lipBlur: number;
  /** The lit wall's light, drawn over the hole rather than added to it. */
  lipColour: readonly [number, number, number];
  /** How far the lip on the coating reaches out from the cut's lower-right side, board points; 0 for none. */
  lipOut: number;
  /** How strong the lip on the coating is. */
  lipOutStrength: number;
  /** The lip's light on the coating, mixed over the coating's own colour. */
  lipOutColour: readonly [number, number, number];
  /**
   * How far inside the field the reveal stops, board points: none. The
   * field is the coating's core, out to its rim's outer edge, and the rim
   * scratches off with the coating; the skin's fields carry the same.
   */
  fieldInset: number;
  /** Board points per texel of the grit tile: her pixels. */
  gritScale: number;
  /**
   * The grit tile's alpha is `0.5 + noise / gritRange`, so the shader reads
   * the noise back as `(a - 0.5) * gritRange`: see art/render/grit.mjs.
   */
  gritRange: number;
  /** How hard the grit pushes the edge: a share of the noise the tile holds. */
  grit: number;
  /**
   * How far inside the scratched area, board points, the wall and the lip
   * are no longer read: the mask reads at most its reach, 8, there, which
   * puts the wall's own edge over 4 points off, where its shadow is under
   * a thousandth, and the lip's edge beyond its reach.
   */
  deep: number;
};

/** The designer's cut, from SPEC-scratch-animation section 3: her numbers, at 3 px a point. */
export const REVEAL_SPEC: RevealLook = {
  /** Her 3.3 px. */
  sigma: 1.1,
  /** Her 8 px. */
  wall: 8 / 3,
  /**
   * Her 3.7 px is 1.233; 1.25 decided. Her coating shifted by `wall`,
   * times the reveal, then blurred, read off the distance field as the
   * blurred hole here less the blurred hole a wall's offset up and left.
   */
  wallSigma: 1.25,
  wallDark: 0.75,
  bandsToCut: false,
  /** Her 1.7 px. */
  lip: 1.7 / 3,
  /** Her lip strength, which the hand-off leaves to us. */
  lipStrength: 1,
  /**
   * Her lip is blurred by 0.7 px, which softens the reveal's ramp,
   * sharpened six times, to about this, as much light in all and her peak
   * of 0.71 along a straight edge.
   */
  lipSharpen: 3.5,
  /** Her 0.7 px. */
  lipBlur: 0.7 / 3,
  /** #966650. */
  lipColour: [0x96 / 255, 0x66 / 255, 0x50 / 255],
  /** She has no lip on the coating. */
  lipOut: 0,
  lipOutStrength: 0,
  lipOutColour: [1, 1, 1],
  fieldInset: 0,
  gritScale: 1 / 3,
  gritRange: 2.5,
  /** Her noise as it is. */
  grit: 1,
  deep: MASK_REACH - 0.1,
};

/**
 * Rossen's cut, from his saved Coin Lean Lab settings (5 Nov 2026):
 * `sSoft` 0.11, `sShadow` 0.47, `sLip` 0.72 and `sDepth` 2.4, at `brush`
 * 20.5 (`FINGER_BRUSH`). The lab draws its scratch at its brush's edge,
 * blurred a little, and then bands along the edge, each the mask shifted
 * against itself: three of shadow inside the hole's upper-left side, a lit
 * wall inside its lower-right side and a lit lip on the coating outside
 * it (template.html:1158-1166, 1249-1297).
 */
export const REVEAL_LAB: RevealLook = {
  /**
   * The lab blurs its 160 px brush by `sSoft` x 14 = 1.54 px, a sigma of
   * 0.77 px, 0.219 points at 2 x 20.5 / 144 points a pixel: an edge rising
   * from 10 to 90 % over 0.563 points. The shader sharpens its soft edge
   * six times, so its ramp is 0.336 sigma: 1.68 rises as the lab's does.
   */
  sigma: 1.68,
  /**
   * The lab's shadow is three bands, the mask shifted down and right by
   * 0.35, 0.7 and 1 x `sDepth`, 0.84, 1.68 and 2.4 points, each black at
   * 0.33 x `sShadow`, 0.155: 0.397 dark up to the cut, 0.286 past 0.84
   * points in and 0.155 past 1.68, to 2.4. One band, as dark at the cut,
   * fitted to them: it ends 1.75 points in, softly over 0.73, 0.013 off
   * theirs on average and holding 1.5 % more shadow in all.
   */
  wall: 1.75,
  wallSigma: 0.73,
  wallDark: 1 - (1 - 0.33 * 0.47) ** 3,
  bandsToCut: true,
  /** The lab's lit wall: the hole inside its lower-right side, 0.6 x `sDepth` deep. */
  lip: 0.6 * 2.4,
  /** 0.8 x `sLip`. */
  lipStrength: 0.8 * 0.72,
  /** The lab's bands end as sharply as its cut. */
  lipSharpen: 6,
  lipBlur: 0,
  /** rgb(150, 96, 78). */
  lipColour: [150 / 255, 96 / 255, 78 / 255],
  /** The lab's lit lip: the coating outside the hole's lower-right side, 0.45 x `sDepth` out, a device pixel at least. */
  lipOut: 0.45 * 2.4,
  /** 1.1 x `sLip`, at most 1. */
  lipOutStrength: Math.min(1, 1.1 * 0.72),
  /** rgb(255, 236, 222). */
  lipOutColour: [1, 236 / 255, 222 / 255],
  fieldInset: 0,
  gritScale: 1 / 3,
  gritRange: 2.5,
  /**
   * The lab's edge carries no grit, but its outline is ragged to a finer
   * grain than a mask of a texel a point holds, so the designer's grit
   * stays, pushing as hard as it did at her softer edge: the push is 2.5 x
   * noise x sigma, so 1.1 / 1.68 of the noise.
   */
  grit: 1.1 / 1.68,
  deep: MASK_REACH - 0.1,
};

/**
 * The look the game draws: Rossen's, as the owner asked for his settings
 * (5 Nov 2026). `REVEAL_SPEC` here draws the designer's again.
 */
export const REVEAL: RevealLook = REVEAL_LAB;

/**
 * The soft edge's values outside which no push of the grit can move the
 * reveal off 0 or 1, sharpened `sharpen` times or more: the push is
 * `4 soft (1 - soft)` times at most `range / 2`, the grit's whole range,
 * so the grit need not be read there.
 */
export function gritBand(
  sharpen: number,
  range: number,
): readonly [number, number] {
  const push = 4 * (range / 2);
  const half = 0.5 / sharpen;
  return [(0.5 - half) / (1 + push), (0.5 + half + push) / (1 + push)];
}

/** The `x` at which the shader's `phi` reaches `share`, by bisection: `phi` rises everywhere. */
function phiInverse(share: number): number {
  let low = -8;
  let high = 8;
  for (let i = 0; i < 60; i++) {
    const middle = (low + high) / 2;
    const value = 1 / (1 + Math.exp(-1.5976 * middle - 0.07056 * middle ** 3));
    if (value < share) low = middle;
    else high = middle;
  }
  return high;
}

/**
 * The SkSL. `float` throughout, which runtime effects run at full precision
 * on a phone's GPU too; `phi` is the logistic fit to the normal curve's
 * integral, within 2e-4 of it everywhere.
 */
export const REVEAL_SKSL = `
uniform shader coating;
uniform shader mask;
uniform shader grit;
uniform float4 cut;
uniform float cutR;
uniform float aa;
uniform float lipAa;
uniform float reach;
uniform float sigma;
uniform float wallSigma;
uniform float wallDark;
uniform float2 wall;
uniform float toCut;
uniform float2 lip;
uniform float lipK;
uniform float lipSharpen;
uniform float2 lipOut;
uniform float lipOutK;
uniform float lipOutReach;
uniform float gritRange;
uniform float2 gritBand;
uniform float deep;
layout(color) uniform half3 lipRgb;
layout(color) uniform half3 lipOutRgb;

float phi(float x) {
  return 1.0 / (1.0 + exp(-1.5976 * x - 0.07056 * x * x * x));
}
float sd(float2 p) {
  return (float(mask.eval(p).a) - 0.5) * 2.0 * reach;
}
float cutDist(float2 p) {
  float2 c = (cut.xy + cut.zw) * 0.5;
  float2 q = abs(p - c) - ((cut.zw - cut.xy) * 0.5 - cutR);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - cutR;
}
float inField(float2 p, float soft) {
  return clamp(0.5 - cutDist(p) / soft, 0.0, 1.0);
}
float edge(float2 p, float s) {
  float u = s - 0.5;
  if (s > gritBand.x && s < gritBand.y) {
    float band = clamp(4.0 * s * (1.0 - s), 0.0, 1.0);
    u += band * (float(grit.eval(p).a) - 0.5) * gritRange;
  }
  return u;
}
float lipHole(float2 p, float u) {
  return clamp(u * lipSharpen + 0.5, 0.0, 1.0) * inField(p, lipAa);
}
half4 main(float2 p) {
  float d = sd(p);
  float u = edge(p, phi(-d / sigma));
  float r = clamp(u * 6.0 + 0.5, 0.0, 1.0) * inField(p, aa);
  half4 c = half4(0.0);
  if (r < 1.0) {
    c = coating.eval(p);
    if (d < lipOutReach) {
      float2 po = p - lipOut;
      float lo = lipHole(po, edge(po, phi(-sd(po) / sigma))) * lipOutK;
      c.rgb = c.rgb * half(1.0 - lo) + lipOutRgb * (c.a * half(lo));
    }
    if (r <= 0.0) {
      return c;
    }
  }
  bool inside = d < -deep;
  float2 q = p - wall;
  float s1 = phi(-cutDist(q) / wallSigma);
  if (!inside) {
    s1 *= phi(-sd(q) / wallSigma);
  }
  float s0 = 1.0;
  float here = 1.0;
  if (toCut < 0.5) {
    s0 = phi(-d / wallSigma) * phi(-cutDist(p) / wallSigma);
    here = lipHole(p, u);
  }
  float sh = clamp(s0 - s1, 0.0, 1.0);
  float2 pl = p + lip;
  float ul = 1.0;
  if (!inside) {
    ul = edge(pl, phi(-sd(pl) / sigma));
  }
  float l = clamp(here - lipHole(pl, ul), 0.0, 1.0) * lipK;
  float a = 1.0 - (1.0 - wallDark * sh) * (1.0 - l);
  float3 rgb = float3(c.rgb) * (1.0 - r) + float3(lipRgb) * (l * r);
  return half4(half3(rgb), half(float(c.a) * (1.0 - r) + a * r));
}
`;

/** The uniforms, by name, as `<Shader>` takes them. */
export type RevealUniforms = {
  cut: readonly [number, number, number, number];
  cutR: number;
  aa: number;
  lipAa: number;
  reach: number;
  sigma: number;
  wallSigma: number;
  wallDark: number;
  wall: readonly [number, number];
  toCut: number;
  lip: readonly [number, number];
  lipK: number;
  lipSharpen: number;
  lipOut: readonly [number, number];
  lipOutK: number;
  lipOutReach: number;
  gritRange: number;
  gritBand: readonly [number, number];
  deep: number;
  lipRgb: readonly [number, number, number];
  lipOutRgb: readonly [number, number, number];
};

/**
 * The uniforms for a tray whose coating clears over `field`, drawn at
 * `pixelsPerPoint` device pixels a board point, in `look`: the cut's edge
 * is antialiased over one of them, and the lit wall's over its blur's
 * width where that is wider. The lip on the coating is read only where it
 * can reach: the hole as the lip reads it ends where no push of the grit
 * can reach it, and the lip lies at most its offset's two sides further,
 * the mask's cubic changing by at most a point a point either way.
 */
export function revealUniforms(
  field: ScratchField,
  pixelsPerPoint: number,
  look: RevealLook = REVEAL,
): RevealUniforms {
  const cut = cutOf(field);
  const aa = pixelsPerPoint > 0 ? 1 / pixelsPerPoint : 1;
  const sharpen = Math.min(6, look.lipSharpen);
  const range = look.gritRange * look.grit;
  const lipOut = look.lipOut > 0 ? Math.max(aa, look.lipOut) : 0;
  const lipReach =
    look.sigma * -phiInverse(gritBand(look.lipSharpen, range)[0]);
  return {
    cut: [cut.left, cut.top, cut.left + cut.width, cut.top + cut.height],
    cutR: Math.min(cut.radius, cut.width / 2, cut.height / 2),
    aa,
    lipAa: Math.max(aa, look.lipBlur * Math.sqrt(2 * Math.PI)),
    reach: MASK_REACH,
    sigma: look.sigma,
    wallSigma: look.wallSigma,
    wallDark: look.wallDark,
    wall: [look.wall, look.wall],
    toCut: look.bandsToCut ? 1 : 0,
    lip: [look.lip, look.lip],
    lipK: look.lipStrength,
    lipSharpen: look.lipSharpen,
    lipOut: [lipOut, lipOut],
    lipOutK: look.lipOutStrength,
    lipOutReach:
      lipOut > 0 && look.lipOutStrength > 0
        ? lipReach + 2 * lipOut + 0.1
        : -2 * MASK_REACH,
    gritRange: range,
    gritBand: gritBand(sharpen, range),
    deep: look.deep,
    lipRgb: look.lipColour,
    lipOutRgb: look.lipOutColour,
  };
}

/** The one call that compiles a runtime effect: `Skia.RuntimeEffect`'s, or CanvasKit's in a test. */
type Compiler<E> = { Make(sksl: string): E | null };

let compiled: unknown;

/**
 * The reveal's effect, compiled once on first use, through `compiler`: on
 * the web Skia exists only once CanvasKit has loaded, so never at import.
 * Null where the GPU's compiler refuses it, and the tray then clears the
 * coating with a hard edge instead.
 */
export function revealEffect<E>(compiler: Compiler<E>): E | null {
  if (compiled === undefined) {
    try {
      compiled = compiler.Make(REVEAL_SKSL);
    } catch {
      compiled = null;
    }
  }
  return compiled as E | null;
}
