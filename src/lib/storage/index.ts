import type { AppState } from "@/types";
import {
  appStateSchema,
  MAX_IMPORT_BYTES,
} from "@/schemas/app-state.schema";
import { createSeededState } from "@/lib/seed/demo-data";
import { nowIso } from "@/lib/utils";

export const STORAGE_KEY = "dayflow:v1";
export const BACKUP_KEY = "dayflow:v1:backup";
export const CORRUPT_KEY = "dayflow:v1:corrupt";

export type StorageResult<T> = {
  data: T | null;
  error: string | null;
};

function migrate(raw: unknown): AppState {
  const parsed = appStateSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  // Soft recovery: if version missing but looks like our shape, try coerce
  if (raw && typeof raw === "object" && "profile" in raw) {
    const withVersion = { version: 1 as const, ...(raw as object) };
    const retry = appStateSchema.safeParse(withVersion);
    if (retry.success) return retry.data;
  }

  throw new Error("Stored data failed validation");
}

export function loadState(): StorageResult<AppState> {
  if (typeof window === "undefined") {
    return { data: null, error: "Not in browser" };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = createSeededState();
      const firstRun: AppState = {
        ...seeded,
        meta: { ...seeded.meta, onboardingCompleted: false },
      };
      saveState(firstRun);
      return { data: firstRun, error: null };
    }

    const json = JSON.parse(raw) as unknown;
    const state = migrate(json);
    return { data: state, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load saved data";
    try {
      const corrupt = window.localStorage.getItem(STORAGE_KEY);
      if (corrupt) {
        window.localStorage.setItem(CORRUPT_KEY, corrupt);
      }
      const seeded = createSeededState();
      saveState(seeded);
      return {
        data: seeded,
        error: `Saved data was unreadable and was reset to demo data (${message}). A copy was kept under ${CORRUPT_KEY}.`,
      };
    } catch {
      return { data: null, error: message };
    }
  }
}

export function saveState(state: AppState): StorageResult<true> {
  if (typeof window === "undefined") {
    return { data: null, error: "Not in browser" };
  }

  try {
    const next: AppState = {
      ...state,
      meta: { ...state.meta, updatedAt: nowIso() },
    };
    const serialized = JSON.stringify(next);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    return { data: true, error: null };
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" || err.code === 22)
    ) {
      return {
        data: null,
        error: "Storage is full. Export your data, then reset demo data.",
      };
    }
    return {
      data: null,
      error: err instanceof Error ? err.message : "Failed to save",
    };
  }
}

export function backupCurrentState(): void {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw) window.localStorage.setItem(BACKUP_KEY, raw);
}

export function parseImportJson(text: string): StorageResult<AppState> {
  if (text.length > MAX_IMPORT_BYTES) {
    return {
      data: null,
      error: "Import file is too large (max 5MB).",
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { data: null, error: "Invalid JSON file." };
  }

  const parsed = appStateSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join(".") || "root";
    return {
      data: null,
      error: `Invalid DayFlow export (${path}: ${issue?.message ?? "schema error"}).`,
    };
  }

  return { data: parsed.data, error: null };
}
