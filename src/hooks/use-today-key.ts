"use client";

import { useEffect, useState } from "react";
import { todayKey } from "@/lib/utils";

/**
 * Recomputes today's date key after midnight / when the tab becomes visible,
 * and bumps a tick every minute so intra-day UI (schedule phases, scores) refreshes.
 */
export function useTodayKey(): [string, number] {
  const [key, setKey] = useState(() => todayKey());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => {
      const next = todayKey();
      setKey((prev) => (prev === next ? prev : next));
      setTick((t) => t + 1);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    const id = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return [key, tick];
}
