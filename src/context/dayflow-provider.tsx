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
import { loadState, saveState } from "@/lib/storage";

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

  useEffect(() => {
    const result = loadState();
    if (result.data) {
      skipSave.current = true;
      dispatch({ type: "HYDRATE", state: result.data });
      applyTheme(result.data.meta.theme);
    }
    if (result.error) {
      setStorageError(result.error);
    }
    setHydrated();
  }, []);

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
    saveTimer.current = setTimeout(() => {
      const result = saveState(state);
      setStorageError(result.error);
    }, 300);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, hydrated]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (state.meta.theme === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [state.meta.theme]);

  const value = useMemo(
    () => ({ state, dispatch, hydrated, storageError }),
    [state, hydrated, storageError],
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

export function useDayFlowActions() {
  const { dispatch } = useDayFlow();
  return useCallback((action: DayFlowAction) => dispatch(action), [dispatch]);
}
