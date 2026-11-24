export const TIMED_OUT = Symbol('timed out');

/** Settles with `value`, or with TIMED_OUT if `value` is still pending after `ms`. */
export async function withinTimeout<T>(
  value: Promise<T> | T,
  ms: number,
): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  try {
    return await Promise.race([value, timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Settles with `value`, or with TIMED_OUT once it has gone `idleMs` without
 * progress, or `ceilingMs` in all however it progresses. `progressAt` gives
 * the latest progress on `performance.now()`'s clock, which a change to the
 * system time does not move; the wait counts as progress at its start.
 */
export async function withinIdleTimeout<T>(
  value: Promise<T> | T,
  idleMs: number,
  ceilingMs: number,
  progressAt: () => number,
): Promise<T | typeof TIMED_OUT> {
  const start = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<typeof TIMED_OUT>((resolve) => {
    const check = () => {
      const due = Math.min(
        start + ceilingMs,
        Math.max(start, progressAt()) + idleMs,
      );
      const left = due - performance.now();
      if (left <= 0) resolve(TIMED_OUT);
      else timer = setTimeout(check, left);
    };
    timer = setTimeout(check, Math.min(idleMs, ceilingMs));
  });
  try {
    return await Promise.race([value, timedOut]);
  } finally {
    clearTimeout(timer);
  }
}
