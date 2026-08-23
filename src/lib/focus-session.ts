export const FOCUS_SESSION_KEY = "dayflow:focus:session";
const FOCUS_CLAIM_KEY = "dayflow:focus:claimed";

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

function isCompletionClaimed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(FOCUS_CLAIM_KEY) === "1";
  } catch {
    return false;
  }
}

/** Atomically claim completion once across tabs and Focus page + watcher. */
function tryClaimCompletion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(FOCUS_CLAIM_KEY) === "1") return false;
    sessionStorage.setItem(FOCUS_CLAIM_KEY, "1");
    sessionStorage.removeItem(FOCUS_SESSION_KEY);
    return true;
  } catch {
    return false;
  }
}

export function clearFocusSession() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(FOCUS_SESSION_KEY);
    sessionStorage.removeItem(FOCUS_CLAIM_KEY);
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
  return tryClaimCompletion();
}

/**
 * If a running session's endAt has passed, clear storage and return it once.
 * Safe to call from a layout watcher while Focus page is unmounted (or mounted).
 */
export function claimExpiredFocusSession(): SavedFocusSession | null {
  if (isCompletionClaimed()) return null;
  const saved = readFocusSession();
  if (!saved || saved.timerState !== "running" || !saved.endAt) return null;
  if (saved.endAt > Date.now()) return null;
  if (!tryClaimCompletion()) return null;
  return saved;
}

export function focusDurationMinutes(saved: Pick<SavedFocusSession, "minutes" | "remaining">) {
  const focusedSeconds = Math.max(0, saved.minutes * 60 - Math.max(0, saved.remaining));
  return Math.max(1, Math.round(focusedSeconds / 60));
}
