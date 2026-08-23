"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type { AppState } from "@/types";
import {
  dayFlowReducer,
  type DayFlowAction,
} from "@/context/dayflow-reducer";
import { createSeededState } from "@/lib/seed/demo-data";
import { STORAGE_KEY, loadState, saveState } from "@/lib/storage";
import { clearFocusSession } from "@/lib/focus-session";
import { todayKey } from "@/lib/utils";

interface DayFlowContextValue {
  state: AppState;
  dispatch: (action: DayFlowAction) => void;
  hydrated: boolean;
  storageError: string | null;
}

const DayFlowContext = createContext<DayFlowContextValue | null>(null);

function applyTheme(theme: AppState["meta"]["theme"]) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  root.classList.toggle("dark", dark);
}

function isQuotaError(message: string | null) {
  return !!message && /storage is full/i.test(message);
}

const ALLOW_WHILE_BLOCKED = new Set<DayFlowAction["type"]>([
  "HYDRATE",
  "REPLACE_STATE",
  "RESET_DEMO",
]);

export function DayFlowProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    dayFlowReducer,
    undefined,
    () => createSeededState(),
  );
  const [hydrated, setHydrated] = useReducer(() => true, false);
  const [storageError, setStorageError] = useReducer(
    (_: string | null, next: string | null) => next,
    null as string | null,
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(true);
  const lastPersisted = useRef<AppState | null>(null);
  const persistBlocked = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const pendingSave = useRef(false);

  const applySaveResult = useCallback((toSave: AppState, result: ReturnType<typeof saveState>) => {
    if (!result.error) {
      lastPersisted.current = toSave;
      persistBlocked.current = false;
      setStorageError(null);
      return;
    }
    setStorageError(result.error);
    if (isQuotaError(result.error) && lastPersisted.current) {
      persistBlocked.current = true;
      skipSave.current = true;
      dispatch({ type: "HYDRATE", state: lastPersisted.current });
    }
  }, []);

  const flushPendingSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!pendingSave.current) return;
    pendingSave.current = false;
    const toSave = stateRef.current;
    applySaveResult(toSave, saveState(toSave));
  }, [applySaveResult]);

  const guardedDispatch = useCallback((action: DayFlowAction) => {
    if (persistBlocked.current && !ALLOW_WHILE_BLOCKED.has(action.type)) {
      setStorageError(
        "Storage is full. Export your data, then reset demo data. Further edits are blocked until storage is freed.",
      );
      return;
    }
    dispatch(action);
    if (action.type === "REPLACE_STATE" || action.type === "RESET_DEMO") {
      clearFocusSession();
    }
  }, []);

  useEffect(() => {
    const result = loadState();
    if (result.data) {
      skipSave.current = true;
      lastPersisted.current = result.data;
      dispatch({ type: "HYDRATE", state: result.data });
      applyTheme(result.data.meta.theme);
    }
    if (result.error) {
      setStorageError(result.error);
    }
    setHydrated();
  }, []);


  // Demote stale "today" tasks after midnight / when the calendar day changes.
  useEffect(() => {
    if (!hydrated) return;
    const run = () => {
      guardedDispatch({ type: "ROLLOVER_STALE_TODAY", today: todayKey() });
    };
    run();
    const id = window.setInterval(run, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hydrated, guardedDispatch]);

  useEffect(() => {
    if (!hydrated) return;
    applyTheme(state.meta.theme);
  }, [hydrated, state.meta.theme]);

  useEffect(() => {
    if (!hydrated) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingSave.current = true;
    saveTimer.current = setTimeout(() => {
      pendingSave.current = false;
      saveTimer.current = null;
      applySaveResult(state, saveState(state));
    }, 300);
    return () => {
      // Clear only — flush on unmount / pagehide so rapid edits stay debounced.
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, [state, hydrated, applySaveResult]);

  useEffect(() => {
    const onHide = () => flushPendingSave();
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      flushPendingSave();
    };
  }, [flushPendingSave]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || event.storageArea !== localStorage) return;
      if (event.newValue == null) return;

      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      pendingSave.current = false;

      const result = loadState();
      if (result.data) {
        skipSave.current = true;
        lastPersisted.current = result.data;
        persistBlocked.current = false;
        dispatch({ type: "HYDRATE", state: result.data });
        applyTheme(result.data.meta.theme);
        setStorageError(null);
        return;
      }
      if (result.error) setStorageError(result.error);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (state.meta.theme === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [state.meta.theme]);

  const value = useMemo(
    () => ({ state, dispatch: guardedDispatch, hydrated, storageError }),
    [state, guardedDispatch, hydrated, storageError],
  );

  return (
    <DayFlowContext.Provider value={value}>{children}</DayFlowContext.Provider>
  );
}

export function useDayFlow() {
  const ctx = useContext(DayFlowContext);
  if (!ctx) {
    throw new Error("useDayFlow must be used within DayFlowProvider");
  }
  return ctx;
}
