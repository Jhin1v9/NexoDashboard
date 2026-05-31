/**
 * 🌙 Luna Mascot — Timer de Inatividade
 * Detecta inatividade do usuário e controla sono/caminhada da Luna
 */

import { useEffect, useRef, useCallback } from "react";
import { useLunaStore, INACTIVITY_SLEEP_MS, INACTIVITY_WALK_MS } from "../stores/lunaStore";

/**
 * Hook que monitora inatividade do usuário
 * - Após 10s de inatividade → Luna começa a andar (walk)
 * - Após 60s de inatividade → Luna dorme (sleep)
 * - Qualquer interação → acorda/reseta timer
 */
export function useInactivityTimer() {
  const { state, isAwake, goToSleep, setState, markInteraction, wakeUp } = useLunaStore();
  const lastActivityRef = useRef(Date.now());
  const walkTimerRef = useRef(null);
  const sleepTimerRef = useRef(null);
  const rafRef = useRef(null);
  const isVisibleRef = useRef(true);

  // Atualiza timestamp de interação
  const bump = useCallback(() => {
    lastActivityRef.current = Date.now();
    markInteraction();

    // Se estava dormindo, acorda
    if (state === "sleep") {
      wakeUp();
    }
    // Se estava andando, volta pro idle
    if (state === "walk") {
      setState("idle");
    }
  }, [state, markInteraction, wakeUp, setState]);

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

    const handleActivity = () => {
      bump();
    };

    // Page Visibility API
    const handleVisibility = () => {
      isVisibleRef.current = !document.hidden;
      if (!document.hidden) {
        // Recalcula delta ao voltar para a aba
        const delta = Date.now() - lastActivityRef.current;
        if (delta > INACTIVITY_SLEEP_MS && isAwake) {
          goToSleep();
        }
      }
    };

    // Registra listeners
    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibility);

    // Loop de verificação via requestAnimationFrame (não depende de setTimeout em aba inativa)
    const checkLoop = () => {
      if (!isVisibleRef.current) {
        rafRef.current = requestAnimationFrame(checkLoop);
        return;
      }

      const delta = Date.now() - lastActivityRef.current;
      const currentState = useLunaStore.getState().state;

      // Sleep após 60s
      if (delta > INACTIVITY_SLEEP_MS && currentState !== "sleep") {
        goToSleep();
      }
      // Walk após 10s (mas não se estiver working/thinking/run)
      else if (
        delta > INACTIVITY_WALK_MS &&
        currentState === "idle" &&
        useLunaStore.getState().isAwake
      ) {
        setState("walk");
      }

      rafRef.current = requestAnimationFrame(checkLoop);
    };

    rafRef.current = requestAnimationFrame(checkLoop);

    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      document.removeEventListener("visibilitychange", handleVisibility);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (walkTimerRef.current) clearTimeout(walkTimerRef.current);
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    };
  }, [bump, goToSleep, setState, isAwake]);

  return { bump };
}
