const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const getPageScrollBehavior = (): ScrollBehavior =>
  prefersReducedMotion() ? 'auto' : 'smooth';

export const scrollToPageTop = () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: getPageScrollBehavior(),
  });
};

export const scrollElementIntoView = (element: HTMLElement | null) => {
  element?.scrollIntoView({
    behavior: getPageScrollBehavior(),
    block: 'start',
    inline: 'nearest',
  });
};

export interface StableScrollOptions {
  /** Sticky chrome above the target: the gap to leave between it and the viewport top. */
  offset?: number;
  /** Hard stop, however unsettled the page still is. */
  maxMs?: number;
  /** How long the target has to sit still before we let go of the page. */
  holdMs?: number;
}

/**
 * LAND ON A TARGET THAT IS STILL MOVING — one continuous glide, never a series of jumps.
 *
 * The page we scroll to is not finished: a region switch mounts an island strip, hero images and
 * a card carousel ABOVE and BELOW the target, sometimes seconds later on a phone. A plain smooth
 * scroll computes its destination once and lands somewhere else entirely; the body height barely
 * changes while it happens, so a ResizeObserver never sees it.
 *
 * The previous answer (02/08/2026) was to re-anchor the target with an INSTANT `scrollBy` every
 * frame for up to 5 s. It put the target in the right place and felt broken doing it: reported as
 * «κάνει παράξενα πάνω-κάτω σαν να κολλάει». Two reasons, both structural rather than tuning —
 *   • the first correction is the whole distance in one frame, so the journey is a teleport
 *     followed by a series of visible tugs as each image lands;
 *   • it re-anchored unconditionally, so for five seconds every swipe was undone under the finger.
 *
 * So: ease toward the target, and RE-READ the target's position every frame. Because the
 * destination is re-measured rather than remembered, content landing above it bends the motion
 * instead of interrupting it — the same reason this is smooth is the reason it is accurate. And
 * the user always wins: the first wheel, touch or key aborts it outright.
 *
 * Returns a cancel function; safe to call more than once.
 */
export const smoothScrollToStableElement = (
  getTarget: () => HTMLElement | null,
  options: StableScrollOptions = {}
): (() => void) => {
  const { offset = 0, maxMs = 5000, holdMs = 400 } = options;
  if (typeof window === 'undefined') return () => {};

  // Exponential ease-out: each frame closes the same FRACTION of whatever distance is left, so a
  // destination that moves mid-flight never restarts the animation. ~95% of the way in ~330 ms.
  const TAU_MS = 110;
  const SETTLED_PX = 1.5;
  /** Frames of "we asked to scroll and the page did not move" before we accept it cannot. */
  const STUCK_FRAMES = 3;
  const instant = prefersReducedMotion();

  let cancelled = false;
  let frame = 0;
  let stableSince: number | null = null;
  let stuckFrames = 0;
  let lastFrameAt = performance.now();
  const startedAt = lastFrameAt;

  const stop = () => {
    if (cancelled) return;
    cancelled = true;
    cancelAnimationFrame(frame);
    window.removeEventListener('wheel', stop);
    window.removeEventListener('touchstart', stop);
    window.removeEventListener('touchmove', stop);
    window.removeEventListener('keydown', stop);
  };

  // Added now, not on the tap that started this: the triggering gesture's touchstart has already
  // fired, so only the NEXT one — a real attempt to scroll — cancels us. touchmove as well as
  // touchstart, for the finger that was already down when we began: it will never send another
  // touchstart, and `wheel` does not exist on touch.
  window.addEventListener('wheel', stop, { passive: true });
  window.addEventListener('touchstart', stop, { passive: true });
  window.addEventListener('touchmove', stop, { passive: true });
  window.addEventListener('keydown', stop);

  const tick = (now: number) => {
    if (cancelled) return;
    // Clamped: a backgrounded tab hands back a huge dt, which would otherwise jump the page.
    const dt = Math.min(now - lastFrameAt, 64);
    lastFrameAt = now;

    const target = getTarget();
    if (target) {
      const delta = target.getBoundingClientRect().top - offset;
      if (Math.abs(delta) <= SETTLED_PX) {
        if (stableSince === null) stableSince = now;
        stuckFrames = 0;
      } else {
        stableSince = null;
        const before = window.scrollY;
        window.scrollBy(0, instant ? delta : delta * (1 - Math.exp(-dt / TAU_MS)));
        // Already at the end of the document (a short results page cannot bring its last section
        // to the top). Without this we would hold the page hostage for the full maxMs.
        stuckFrames = Math.abs(window.scrollY - before) < 0.5 ? stuckFrames + 1 : 0;
      }
    }

    const held = stableSince !== null && now - stableSince >= holdMs;
    if (held || stuckFrames >= STUCK_FRAMES || now - startedAt >= maxMs) {
      stop();
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  frame = requestAnimationFrame(tick);
  return stop;
};
