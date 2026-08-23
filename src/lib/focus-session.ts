export const FOCUS_SESSION_KEY = "dayflow:focus:session";

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
    sessionStorage.setItem(FOCUS_SESSION_KEY, value);
  } catch {
    // ignore
  }
}
