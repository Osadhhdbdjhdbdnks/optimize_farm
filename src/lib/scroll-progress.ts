/**
 * Scroll-progress engine — reverse engineered from
 * https://www.agrumeafarm.it/en/dispensa/caponata (Vue/Nuxt bundle, scoped
 * component `product-hero`, data-v-3d24a818).
 *
 * How the original works (evidence extracted from the site's CSS + JS):
 *  1. The hero stage element exposes a single custom property `--ph`
 *     (initialised to 0) that drives every animated layer via pure CSS:
 *       .product-hero__stage { --ph: 0 }
 *       .product-hero__jar   { transform: translate(-50%)
 *                              translateY(calc(var(--ph) * var(--ph-jar-rise)))
 *                              rotate(calc(var(--ph) * var(--ph-jar-rotate)))
 *                              scale(calc(var(--ph-jar-scale-from)
 *                                   + var(--ph) * (var(--ph-jar-scale-to) - var(--ph-jar-scale-from)))) }
 *       .product-hero__title { transform: translate(-50%, calc(-50% + var(--ph) * var(--ph-title-fall))) }
 *  2. A GSAP ScrollTrigger writes the progress into `--ph`:
 *       ScrollTrigger.create({ trigger: rootRef, start: "top top",
 *         end: () => `+=${window.innerHeight * 0.4}`, scrub: true,
 *         onUpdate: n => stage.style.setProperty("--ph", `${n.progress}`) })
 *     (`Ae = .4` in the minified bundle → scroll window = 40vh.)
 *  3. The jar artwork is a WebGL cylinder-label shader whose spin uniform is
 *     fed by `setSpin(progress)`; the label texture repeats 182° of arc and
 *     the shader maps `uOffset = h - G` with `h = ae / 360`, i.e. one full
 *     wrap per 0→1 progress. Visually: the product rotates a full turn while
 *     you scroll the hero out.
 *  4. Everything is gated behind `prefers-reduced-motion: reduce`.
 *
 * This module re-implements steps 1–4 dependency-free (no GSAP needed for a
 * single scrubbed variable): clamp + linear map + shared rAF batcher.
 */

export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/**
 * Map an element's scroll position to a 0→1 progress value, exactly like
 * ScrollTrigger `start:"top top", end:"+=range"`:
 * progress 0 when the element top reaches the viewport top, 1 once it has
 * scrolled `range` pixels further up. Reversible on scroll-back (scrub).
 */
export function scrollProgress(
  rectTop: number,
  rangePx: number,
  vh: number,
): number {
  // Distance travelled since the element top passed the viewport top.
  const scrolled = -rectTop;
  return clamp(scrolled / Math.max(1, rangePx), 0, 1);
}

/** Default scroll window used by the reference site (innerHeight * 0.4). */
export const HERO_SCROLL_RANGE_VH = 0.4;

type ProgressCallback = (progress: number) => void;

/**
 * Shared requestAnimationFrame batcher: one rAF loop drives every observed
 * element per frame (mirrors ScrollTrigger's single ticker), reads all rects
 * first, then invokes callbacks — no layout thrash between read/write.
 */
const watchers = new Map<Element, { cb: ProgressCallback; rangeVh: number }>();
let rafId = 0;
let running = false;

const tick = () => {
  rafId = 0;
  if (!watchers.size) {
    running = false;
    return;
  }
  const vh = window.innerHeight || 1;
  // Read phase — collect every rect before any callback mutates styles.
  const readings: Array<{ el: Element; cb: ProgressCallback; p: number }> = [];
  watchers.forEach(({ cb, rangeVh }, el) => {
    readings.push({ el, cb, p: scrollProgress(el.getBoundingClientRect().top, vh * rangeVh, vh) });
  });
  // Write phase.
  for (const { cb, p } of readings) cb(p);
  schedule();
};

const schedule = () => {
  if (!rafId) rafId = requestAnimationFrame(tick);
};

// Only listen to scroll while at least one watcher exists.
const onScrollOrResize = () => schedule();

export function observeScrollProgress(
  el: Element,
  cb: ProgressCallback,
  rangeVh: number = HERO_SCROLL_RANGE_VH,
): () => void {
  watchers.set(el, { cb, rangeVh });
  if (!running) {
    running = true;
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
  }
  schedule();
  return () => {
    watchers.delete(el);
    if (!watchers.size && running) {
      running = false;
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
