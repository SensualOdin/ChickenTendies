import { useEffect, useState } from "react";

/**
 * Tracks the user's prefers-reduced-motion setting.
 *
 * Swipe cards, match celebrations, and confetti are playful animations — but
 * users who've set a system-level motion preference should get the flatter,
 * opacity-only path instead. Components read this and gate spring stiffness,
 * rotation, and looping scale/rotate animations behind it.
 *
 * Framer Motion ships its own `useReducedMotion`, but this local hook is a
 * tiny shim so call sites don't need to import Framer's version and can stay
 * consistent across components that use plain CSS transitions too.
 */
export function useReducedMotion(): boolean {
  const getInitial = () => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };

  const [prefers, setPrefers] = useState<boolean>(getInitial);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setPrefers(e.matches);
    // Older Safari uses addListener; modern uses addEventListener.
    if (mql.addEventListener) {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, []);

  return prefers;
}
