export const FOCUS_SESSION_KEY = "dayflow:focus:session";

export type FocusTimerState = "idle" | "running" | "paused" | "completed";

export type SavedFocusSession = {
  minutes: number;
  remaining: number;
  timerState: FocusTimerState;
  endAt: number | null;
  startedAt: string | null;
  taskId: string;
  goalId: string;
};

/** Prevents double COMPLETE_FOCUS from Focus page + layout watcher. */
let completionClaimed = false;

export function clearFocusSession() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(FOCUS_SESSION_KEY);
  } catch {
    // ignore
  }
}

export function readFocusSessionRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(FOCUS_SESSION_KEY);
  } catch {
    return null;
  }
}

export function writeFocusSessionRaw(value: string) {
  if (typeof window === "undefined") return;
  try {
    completionClaimed = false;
    sessionStorage.setItem(FOCUS_SESSION_KEY, value);
  } catch {
    // ignore
  }
}

export function parseFocusSession(raw: string | null): SavedFocusSession | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedFocusSession;
  } catch {
    clearFocusSession();
    return null;
  }
}

export function readFocusSession(): SavedFocusSession | null {
  return parseFocusSession(readFocusSessionRaw());
}

/** Claim completion for the mounted Focus page timer (running hit 0). */
export function claimFocusCompletion(): boolean {
  if (completionClaimed) return false;
  completionClaimed = true;
  clearFocusSession();
  return true;
}

/**
 * If a running session's endAt has passed, clear storage and return it once.
 * Safe to call from a layout watcher while Focus page is unmounted (or mounted).
 */
export function claimExpiredFocusSession(): SavedFocusSession | null {
  if (completionClaimed) return null;
  const saved = readFocusSession();
  if (!saved || saved.timerState !== "running" || !saved.endAt) return null;
  if (saved.endAt > Date.now()) return null;
  completionClaimed = true;
  clearFocusSession();
  return saved;
}

export function focusDurationMinutes(saved: Pick<SavedFocusSession, "minutes" | "remaining">) {
  const focusedSeconds = Math.max(0, saved.minutes * 60 - Math.max(0, saved.remaining));
  return Math.max(1, Math.round(focusedSeconds / 60));
}
