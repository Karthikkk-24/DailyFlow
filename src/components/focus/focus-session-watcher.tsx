"use client";

import { useEffect } from "react";
import { useDayFlow } from "@/context/dayflow-provider";
import {
  claimExpiredFocusSession,
  focusDurationMinutes,
} from "@/lib/focus-session";
import { nowIso } from "@/lib/utils";

/**
 * Completes expired Focus sessions even when /focus is unmounted.
 */
export function FocusSessionWatcher() {
  const { dispatch } = useDayFlow();

  useEffect(() => {
    const tick = () => {
      const expired = claimExpiredFocusSession();
      if (!expired) return;
      const duration = focusDurationMinutes({
        minutes: expired.minutes,
        remaining: 0,
      });
      dispatch({
        type: "COMPLETE_FOCUS",
        session: {
          durationMinutes: duration,
          startedAt: expired.startedAt ?? nowIso(),
          completedAt: nowIso(),
          linkedTaskId: expired.taskId || undefined,
          linkedGoalId: expired.goalId || undefined,
        },
      });
    };

    tick();
    const id = window.setInterval(tick, 1000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", tick);
    };
  }, [dispatch]);

  return null;
}
