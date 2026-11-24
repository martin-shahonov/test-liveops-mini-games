import { PIXI } from '@betty-mini-games/test-liveops-sdk'

import type { RevealUniforms } from '../../ported/tray/revealShader'
import { REVEAL } from '../../ported/tray/revealShader'
import type { CellBox } from '../../ported/tray'
import { cellFadeGrow } from '../../ported/tray/cellFade'
import { cutOf, type ScratchField } from '../../ported/tray/field'
import type { Mask } from '../../ported/tray/mask'
import { UNTOUCHED } from '../../ported/tray/mask'

/** The most cells a tray fades one by one: a 12-cell card's. */
const MAX_CELLS = 16

const VERTEX = /* glsl */ `
in vec2 aPosition;
out vec2 vP;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vP = aPosition;
}
`

/**
 * MiniGames' `REVEAL_SKSL`, line for line, in GLSL ES 3: the coating cut by the finger's
 * mask with the ragged, shaded edge. Then what the Skia scene drew over it in the same
 * layer, here folded into the one pass: each cell's fade and the Quick Scratch band (both
 * inside the field's cut), and the whole floor once the box is done.
 *
 * `p` is the tray's own board points. The mask is a texel a point, read with the cubic
 * B-spline Skia read it with (four bilinear taps); the grit with a bilinear read, tiled.
 */
const FRAGMENT = /* glsl */ `
precision highp float;
in vec2 vP;
out vec4 finalColor;

uniform sampler2D uCoating;
uniform sampler2D uMask;
uniform sampler2D uGrit;

uniform vec2 uSize;
uniform vec2 uMaskSize;
uniform float uGritTile;
uniform vec4 cut;
uniform float cutR;
uniform float aa;
uniform float lipAa;
uniform float reach;
uniform float sigma;
uniform float wallSigma;
uniform float wallDark;
uniform vec2 wall;
uniform float toCut;
uniform vec2 lip;
uniform float lipK;
uniform float lipSharpen;
uniform vec2 lipOut;
uniform float lipOutK;
uniform float lipOutReach;
uniform float gritRange;
uniform vec2 gritBand;
uniform float deep;
uniform vec3 lipRgb;
uniform vec3 lipOutRgb;

uniform float uFoilIn;
uniform float uFloor;
uniform vec4 uBand;
uniform vec4 uFadeRects[${MAX_CELLS}];
uniform float uFades[${MAX_CELLS}];
uniform float uFadeR;
uniform float uCells;

// The cubic B-spline over the mask, its texels at their centres, from four bilinear reads.
float maskAt(vec2 p) {
  vec2 t = p - 0.5;
  vec2 f = fract(t);
  vec2 i = t - f;
  vec2 f2 = f * f;
  vec2 f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
  vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
  vec2 w3 = f3 / 6.0;
  vec2 g0 = w0 + w1;
  vec2 g1 = w2 + w3;
  vec2 h0 = i - 0.5 + w1 / g0;
  vec2 h1 = i + 1.5 + w3 / g1;
  vec2 s = 1.0 / uMaskSize;
  float a00 = texture(uMask, (vec2(h0.x, h0.y) + 0.5) * s).r;
  float a10 = texture(uMask, (vec2(h1.x, h0.y) + 0.5) * s).r;
  float a01 = texture(uMask, (vec2(h0.x, h1.y) + 0.5) * s).r;
  float a11 = texture(uMask, (vec2(h1.x, h1.y) + 0.5) * s).r;
  return g0.y * (g0.x * a00 + g1.x * a10) + g1.y * (g0.x * a01 + g1.x * a11);
}
vec4 coatingAt(vec2 p) {
  if (p.x < 0.0 || p.y < 0.0 || p.x > uSize.x || p.y > uSize.y) return vec4(0.0);
  return texture(uCoating, p / uSize);
}
float gritAt(vec2 p) {
  return texture(uGrit, p / uGritTile).a;
}

float phi(float x) {
  return 1.0 / (1.0 + exp(-1.5976 * x - 0.07056 * x * x * x));
}
float sd(vec2 p) {
  return (maskAt(p) - 0.5) * 2.0 * reach;
}
float roundedDist(vec2 p, vec4 box, float r) {
  vec2 c = (box.xy + box.zw) * 0.5;
  vec2 q = abs(p - c) - ((box.zw - box.xy) * 0.5 - r);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float cutDist(vec2 p) {
  return roundedDist(p, cut, cutR);
}
float inField(vec2 p, float soft) {
  return clamp(0.5 - cutDist(p) / soft, 0.0, 1.0);
}
float edge(vec2 p, float s) {
  float u = s - 0.5;
  if (s > gritBand.x && s < gritBand.y) {
    float band = clamp(4.0 * s * (1.0 - s), 0.0, 1.0);
    u += band * (gritAt(p) - 0.5) * gritRange;
  }
  return u;
}
float lipHole(vec2 p, float u) {
  return clamp(u * lipSharpen + 0.5, 0.0, 1.0) * inField(p, lipAa);
}
vec4 reveal(vec2 p) {
  float d = sd(p);
  float u = edge(p, phi(-d / sigma));
  float r = clamp(u * 6.0 + 0.5, 0.0, 1.0) * inField(p, aa);
  vec4 c = vec4(0.0);
  if (r < 1.0) {
    c = coatingAt(p) * uFoilIn;
    if (d < lipOutReach) {
      vec2 po = p - lipOut;
      float lo = lipHole(po, edge(po, phi(-sd(po) / sigma))) * lipOutK;
      c.rgb = c.rgb * (1.0 - lo) + lipOutRgb * (c.a * lo);
    }
    if (r <= 0.0) {
      return c;
    }
  }
  bool inside = d < -deep;
  vec2 q = p - wall;
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
  vec2 pl = p + lip;
  float ul = 1.0;
  if (!inside) {
    ul = edge(pl, phi(-sd(pl) / sigma));
  }
  float l = clamp(here - lipHole(pl, ul), 0.0, 1.0) * lipK;
  float a = 1.0 - (1.0 - wallDark * sh) * (1.0 - l);
  vec3 rgb = c.rgb * (1.0 - r) + lipRgb * (l * r);
  return vec4(rgb, c.a * (1.0 - r) + a * r);
}

void main() {
  vec2 p = vP;
  vec4 c = reveal(p);
  // What clears a cell's coating whole, or the band's, clears it only inside the cut.
  float inCut = inField(p, aa);
  float keep = 1.0;
  for (int i = 0; i < ${MAX_CELLS}; i++) {
    if (float(i) >= uCells) break;
    float f = uFades[i];
    if (f <= 0.0) continue;
    float cov = clamp(0.5 - roundedDist(p, uFadeRects[i], uFadeR) / aa, 0.0, 1.0);
    keep *= 1.0 - f * cov * inCut;
  }
  // The band: black at its near end, clear at its far one, along the diagonal.
  float t = dot(p, uBand.xy);
  float wipe = clamp((uBand.w - t) / max(1e-4, uBand.w - uBand.z), 0.0, 1.0);
  keep *= 1.0 - wipe * inCut;
  keep *= 1.0 - uFloor;
  finalColor = c * keep;
#if DEBUG == 1
  finalColor = coatingAt(p);
#elif DEBUG == 2
  finalColor = vec4(vec3(maskAt(p)), 1.0);
#elif DEBUG == 3
  finalColor = vec4(vec3(gritAt(p)), 1.0);
#endif
}
`

/** A box grown by `by` on every side. */
const grown = (cell: CellBox, by: number): CellBox => ({
    left: cell.left - by,
    top: cell.top - by,
    width: cell.width + 2 * by,
    height: cell.height + 2 * by,
})

/**
 * One tray's coating as MiniGames' `TrayScene` draws it: a quad over the tray's box in
 * its own board points, drawn by the reveal shader from the coating, the finger's mask
 * and the grit. The tray's state (`TrayShared`) is read into its uniforms each frame.
 */
export class RevealMesh extends PIXI.Mesh<PIXI.MeshGeometry, PIXI.Shader> {
    protected _maskSource: PIXI.BufferImageSource
    /** The mask's codes, four bytes a texel: a single-channel upload would need an unpack alignment Pixi does not set. */
    protected _maskCodes: Uint8Array
    protected _uniforms: PIXI.UniformGroup
    protected _fadeRects: Float32Array
    protected _fades: Float32Array

    constructor(options: {
        width: number
        height: number
        coating: PIXI.Texture
        grit: PIXI.Texture
        field: ScratchField
        cells: readonly CellBox[]
        cellRadius: number
        uniforms: RevealUniforms
    }) {
        const { width, height, coating, grit, field, cells, cellRadius, uniforms } = options
        const geometry = new PIXI.MeshGeometry({
            positions: new Float32Array([0, 0, width, 0, width, height, 0, height]),
            uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
            indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
        })
        const codes = new Uint8Array([UNTOUCHED, UNTOUCHED, UNTOUCHED, UNTOUCHED])
        const maskSource = new PIXI.BufferImageSource({
            resource: codes,
            width: 1,
            height: 1,
            format: 'rgba8unorm',
            scaleMode: 'linear',
        })
        grit.source.addressMode = 'repeat'
        grit.source.scaleMode = 'linear'
        const fadeRects = new Float32Array(MAX_CELLS * 4)
        const fades = new Float32Array(MAX_CELLS)
        const grow = cellFadeGrow(cells)
        cells.slice(0, MAX_CELLS).forEach((cell, i) => {
            const g = grown(cell, grow)
            fadeRects.set([g.left, g.top, g.left + g.width, g.top + g.height], i * 4)
        })
        const u = uniforms
        const revealUniforms = new PIXI.UniformGroup({
            uSize: { value: new Float32Array([width, height]), type: 'vec2<f32>' },
            uMaskSize: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
            uGritTile: { value: REVEAL.gritScale * grit.width, type: 'f32' },
            cut: { value: new Float32Array(u.cut), type: 'vec4<f32>' },
            cutR: { value: u.cutR, type: 'f32' },
            aa: { value: u.aa, type: 'f32' },
            lipAa: { value: u.lipAa, type: 'f32' },
            reach: { value: u.reach, type: 'f32' },
            sigma: { value: u.sigma, type: 'f32' },
            wallSigma: { value: u.wallSigma, type: 'f32' },
            wallDark: { value: u.wallDark, type: 'f32' },
            wall: { value: new Float32Array(u.wall), type: 'vec2<f32>' },
            toCut: { value: u.toCut, type: 'f32' },
            lip: { value: new Float32Array(u.lip), type: 'vec2<f32>' },
            lipK: { value: u.lipK, type: 'f32' },
            lipSharpen: { value: u.lipSharpen, type: 'f32' },
            lipOut: { value: new Float32Array(u.lipOut), type: 'vec2<f32>' },
            lipOutK: { value: u.lipOutK, type: 'f32' },
            lipOutReach: { value: u.lipOutReach, type: 'f32' },
            gritRange: { value: u.gritRange, type: 'f32' },
            gritBand: { value: new Float32Array(u.gritBand), type: 'vec2<f32>' },
            deep: { value: u.deep, type: 'f32' },
            lipRgb: { value: new Float32Array(u.lipRgb), type: 'vec3<f32>' },
            lipOutRgb: { value: new Float32Array(u.lipOutRgb), type: 'vec3<f32>' },
            uFoilIn: { value: 1, type: 'f32' },
            uFloor: { value: 0, type: 'f32' },
            uBand: { value: new Float32Array([1, 0, -2e6, -2e6 + 1]), type: 'vec4<f32>' },
            uFadeRects: { value: fadeRects, type: 'vec4<f32>', size: MAX_CELLS },
            uFades: { value: fades, type: 'f32', size: MAX_CELLS },
            uFadeR: { value: cellRadius + grow, type: 'f32' },
            uCells: { value: Math.min(cells.length, MAX_CELLS), type: 'f32' },
        })
        const shader = PIXI.Shader.from({
            gl: { vertex: VERTEX, fragment: FRAGMENT.replace('precision highp float;', `precision highp float;\n#define DEBUG ${Number(new URLSearchParams(location.search).get('debugMesh') ?? 0)}`) },
            resources: {
                uCoating: coating.source,
                uMask: maskSource,
                uGrit: grit.source,
                revealUniforms,
            },
        })
        super({ geometry, shader })
        this._maskSource = maskSource
        this._maskCodes = codes
        this._uniforms = revealUniforms
        this._fadeRects = fadeRects
        this._fades = fades
        void cutOf(field)
    }

    /** Uploads the mask again (MiniGames' `maskVersion` bump): its codes are read as they stand. */
    uploadMask(mask: Mask): void {
        const source = this._maskSource
        const count = mask.width * mask.height
        if (this._maskCodes.length !== count * 4) {
            this._maskCodes = new Uint8Array(count * 4)
            source.resource = this._maskCodes
            source.resize(mask.width, mask.height)
            const size = this._uniforms.uniforms.uMaskSize as Float32Array
            size[0] = mask.width
            size[1] = mask.height
        }
        const out = this._maskCodes
        const codes = mask.codes
        // Every channel the code: an alpha of 0 would premultiply the code away.
        for (let i = 0; i < count; i++) {
            const code = codes[i]!
            const o = i * 4
            out[o] = code
            out[o + 1] = code
            out[o + 2] = code
            out[o + 3] = code
        }
        source.update()
    }

    /** The fades MiniGames' scene reads off `TrayShared`: the cells', the band's, the floor's and the coating's coming back. */
    setFades(fades: readonly number[], band: { ux: number; uy: number; near: number; far: number }, floor: number, foilIn: number): void {
        const u = this._uniforms.uniforms
        for (let i = 0; i < this._fades.length; i++) this._fades[i] = fades[i] ?? 0
        const b = u.uBand as Float32Array
        b[0] = band.ux
        b[1] = band.uy
        b[2] = band.near
        b[3] = band.far
        u.uFloor = floor
        u.uFoilIn = foilIn
        this._uniforms.update()
    }
}
