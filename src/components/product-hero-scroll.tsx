"use client";

import { useEffect, useRef } from "react";
import {
  HERO_SCROLL_RANGE_VH,
  observeScrollProgress,
  prefersReducedMotion,
} from "@/lib/scroll-progress";

/**
 * Scroll-driven product rotation for the dispensa detail pages.
 *
 * Faithful re-implementation of agrumeafarm.it/en/dispensa/caponata's
 * `product-hero`: a GSAP ScrollTrigger (`start:"top top"`,
 * `end:"+=" + innerHeight*0.4`, `scrub:true`) writes its progress into the
 * CSS variable `--ph` on the stage element; the jar (product artwork) then
 * rotates `calc(var(--ph) * var(--ph-jar-rotate))`, rises and scales down,
 * while the title "falls" — all pure CSS transforms driven by that one
 * variable. The WebGL label shader spins one full turn over the same 0→1
 * range (ProductViewer's `scrollTurns={1}` matches this).
 *
 * Motion is disabled entirely under `prefers-reduced-motion`, exactly like
 * the reference site's matchMedia guard.
 */
export function ProductHeroScroll({
  children,
}: {
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return;
    // Reference site bails out completely when reduced motion is requested.
    if (prefersReducedMotion()) return;

    let last = "";
    const unsubscribe = observeScrollProgress(
      root,
      (progress) => {
        const value = progress.toFixed(4);
        if (value === last) return; // avoid redundant style writes
        last = value;
        stage.style.setProperty("--ph", value);
      },
      HERO_SCROLL_RANGE_VH,
    );
    return unsubscribe;
  }, []);

  return (
    <div ref={rootRef} className="pdm-hero-scroll" data-slot="product-hero-scroll">
      <div ref={stageRef} className="pdm-hero-scroll__stage">
        {children}
      </div>
    </div>
  );
}
