"use client";

import { useEffect, useState } from "react";
import { todayKey } from "@/lib/utils";

/** Recomputes today's date key after midnight / when the tab becomes visible. */
export function useTodayKey() {
  const [key, setKey] = useState(() => todayKey());

  useEffect(() => {
    const refresh = () => {
      const next = todayKey();
      setKey((prev) => (prev === next ? prev : next));
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

  return key;
}
