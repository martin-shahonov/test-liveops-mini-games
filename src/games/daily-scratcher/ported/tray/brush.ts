/**
 * The brush the coin clears the coating with, as the designer drew it
 * (SPEC-scratch-animation section 3): round, 40 px across its radius at her
 * 3 px a point. A stroke is a capsule from the last point to the next, so
 * a frame's stamps join into one trail; a touch that never moves is its
 * disc.
 */
export const BRUSH_RADIUS = 40 / 3;
export const BRUSH_WIDTH = 2 * BRUSH_RADIUS;
