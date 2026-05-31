/**
 * 🌙 Luna Mascot — Eye Tracking
 * Segue o mouse suavemente com dampening (lerp)
 */

import { useEffect, useRef, useCallback } from "react";

/**
 * Hook que retorna posição normalizada do mouse (0-1) com suavização
 * @returns {{x: number, y: number}} Posição normalizada do mouse
 */
export function useEyeTracking() {
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const smoothRef = useRef({ x: 0.5, y: 0.5 });
  const rafRef = useRef(null);

  const lerp = (a, b, t) => a + (b - a) * t;

  const handleMouseMove = useCallback((e) => {
    mouseRef.current = {
      x: Math.max(0, Math.min(1, e.clientX / window.innerWidth)),
      y: Math.max(0, Math.min(1, e.clientY / window.innerHeight)),
    };
  }, []);

  useEffect(() => {
    // Verifica prefers-reduced-motion
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dampening = prefersReduced ? 0.05 : 0.15; // mais lento se reduced motion

    const animate = () => {
      smoothRef.current.x = lerp(smoothRef.current.x, mouseRef.current.x, dampening);
      smoothRef.current.y = lerp(smoothRef.current.y, mouseRef.current.y, dampening);
      rafRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleMouseMove]);

  return smoothRef;
}
