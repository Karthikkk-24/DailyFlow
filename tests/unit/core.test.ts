import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeStreak,
  goalProgress,
  recomputeTodaySnapshot,
} from "@/lib/analytics/score";
import { goalProgressOverTime } from "@/lib/analytics/insights";
import { parseImportJson, saveState, STORAGE_KEY } from "@/lib/storage";
import { createSeededState } from "@/lib/seed/demo-data";
import type { AppState, Habit, HabitLog } from "@/types";
import { format, subDays } from "date-fns";
import { energyGuidance, focusMinutesForEnergy, weekDates } from "@/lib/utils";

describe("goalProgress", () => {
  it("returns 0 for empty milestones", () => {
    expect(goalProgress([])).toBe(0);
  });

  it("calculates partial and full progress", () => {
    expect(
      goalProgress([
        { completed: true },
        { completed: false },
        { completed: true },
        { completed: false },
      ]),
    ).toBe(50);
    expect(
      goalProgress([{ completed: true }, { completed: true }]),
    ).toBe(100);
  });
});

describe("computeStreak", () => {
  const habit: Habit = {
    id: "h1",
    name: "Read",
    icon: "BookOpen",
    frequency: "daily",
    targetDays: [0, 1, 2, 3, 4, 5, 6],
    createdAt: new Date().toISOString(),
  };

  it("counts consecutive completed due days", () => {
    const asOf = new Date("2026-08-20T12:00:00");
    const logs: HabitLog[] = [0, 1, 2].map((i) => ({
      habitId: "h1",
      date: format(subDays(asOf, i), "yyyy-MM-dd"),
      completed: true,
    }));
    const { current } = computeStreak(habit, logs, asOf);
    expect(current).toBe(3);
  });

  it("breaks on a missed due day", () => {
    const asOf = new Date("2026-08-20T12:00:00");
    const logs: HabitLog[] = [
      {
        habitId: "h1",
        date: format(subDays(asOf, 0), "yyyy-MM-dd"),
        completed: true,
      },
      {
        habitId: "h1",
        date: format(subDays(asOf, 2), "yyyy-MM-dd"),
        completed: true,
      },
    ];
    const { current } = computeStreak(habit, logs, asOf);
    expect(current).toBe(1);
  });
});

describe("recomputeTodaySnapshot", () => {
  it("returns a score between 0 and 100", () => {
    const state = createSeededState();
    const snap = recomputeTodaySnapshot(state);
    expect(snap.todayScore).toBeGreaterThanOrEqual(0);
    expect(snap.todayScore).toBeLessThanOrEqual(100);
    expect(snap.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("handles empty activity", () => {
    const state = createSeededState();
    const empty: AppState = {
      ...state,
      tasks: [],
      habits: [],
      habitLogs: [],
      scheduleBlocks: [],
      focusSessions: [],
    };
    const snap = recomputeTodaySnapshot(empty);
    expect(snap.todayScore).toBe(0);
  });
it("ignores historical done tasks when scoring today", () => {
    const state = createSeededState();
    const base = recomputeTodaySnapshot(state);
    const withOldDone: AppState = {
      ...state,
      tasks: [
        ...state.tasks,
        ...Array.from({ length: 40 }, (_, i) => ({
          id: `old-${i}`,
          title: `Old ${i}`,
          status: "done" as const,
          priority: "low" as const,
          category: "Work",
          completedAt: "2026-01-01T12:00:00.000Z",
          createdAt: "2026-01-01T10:00:00.000Z",
          updatedAt: "2026-01-01T12:00:00.000Z",
          order: i,
        })),
      ],
    };
    const next = recomputeTodaySnapshot(withOldDone);
    expect(next.todayScore).toBe(base.todayScore);
    expect(next.tasksCompleted).toBe(base.tasksCompleted);
  });

  it("counts backlog tasks due today as planned work", () => {
    const state = createSeededState();
    const key = format(new Date(), "yyyy-MM-dd");
    const withoutBacklog = {
      ...state,
      tasks: state.tasks.filter((t) => !(t.status === "backlog" && t.dueDate === key)),
    };
    const base = recomputeTodaySnapshot(withoutBacklog);
    const withBacklogDue: AppState = {
      ...withoutBacklog,
      tasks: [
        ...withoutBacklog.tasks,
        {
          id: "backlog-due",
          title: "Due backlog",
          status: "backlog",
          priority: "medium",
          category: "Work",
          dueDate: key,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          order: 0,
        },
      ],
    };
    const next = recomputeTodaySnapshot(withBacklogDue);
    // More planned unfinished work lowers or holds task component when none completed from that set
    expect(next.breakdown.tasks).toBeLessThanOrEqual(base.breakdown.tasks);
  });
});

describe("parseImportJson", () => {
  it("accepts a valid seeded export", () => {
    const state = createSeededState();
    const result = parseImportJson(JSON.stringify(state));
    expect(result.error).toBeNull();
    expect(result.data?.version).toBe(1);
  });

  it("rejects invalid JSON", () => {
    const result = parseImportJson("{not json");
    expect(result.data).toBeNull();
    expect(result.error).toMatch(/Invalid JSON/i);
  });

  it("rejects wrong schema", () => {
    const result = parseImportJson(JSON.stringify({ version: 1 }));
    expect(result.data).toBeNull();
    expect(result.error).toMatch(/Invalid DayFlow/i);
  });
});

describe("saveState validation", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
        clear: () => store.clear(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes valid state", () => {
    const state = createSeededState();
    const result = saveState(state);
    expect(result.error).toBeNull();
    expect(result.data).toBe(true);
    expect(store.get(STORAGE_KEY)).toBeTruthy();
  });

  it("refuses invalid state and leaves prior storage unchanged", () => {
    const good = createSeededState();
    expect(saveState(good).error).toBeNull();
    const before = store.get(STORAGE_KEY);

    const bad = {
      ...good,
      profile: {
        ...good.profile,
        name: "", // schema requires min(1)
      },
    };
    const result = saveState(bad);
    expect(result.data).toBeNull();
    expect(result.error).toMatch(/Could not save/i);
    expect(store.get(STORAGE_KEY)).toBe(before);
  });
});

describe("createSeededState schedule week", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("aligns seeded blocks to Mon–Sun week when today is Sunday", () => {
    // 2026-08-16 is a Sunday — the buggy formula used to shift into next week
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T12:00:00"));
    const state = createSeededState();
    const expected = weekDates(new Date(), 1).map((d) => format(d, "yyyy-MM-dd"));
    const dates = [
      ...new Set(state.scheduleBlocks.map((b) => b.date)),
    ].sort();
    expect(dates).toEqual(expected);
    expect(dates[0]).toBe("2026-08-10");
    expect(dates[6]).toBe("2026-08-16");
  });
});

describe("personalizeAfterOnboarding", () => {
  it("seeds weekday deep-work blocks inside working hours", async () => {
    const { personalizeAfterOnboarding, createSeededState } = await import(
      "@/lib/seed/demo-data"
    );
    const base = createSeededState();
    // Clear blocks so seeding is observable
    const emptyBlocks = { ...base, scheduleBlocks: [] };
    const next = personalizeAfterOnboarding(emptyBlocks, {
      ...base.profile,
      workingHours: { start: "10:00", end: "16:00" },
    });
    const deep = next.scheduleBlocks.filter((b) => b.category === "deep_work");
    expect(deep.length).toBeGreaterThan(0);
    expect(deep.every((b) => b.startTime === "10:00")).toBe(true);
    expect(deep.every((b) => b.endTime === "12:00")).toBe(true);
  });
});

describe("rebuildHistorySnapshots", () => {
  it("matches focus minutes from seeded sessions", async () => {
    const { createSeededState } = await import("@/lib/seed/demo-data");
    const { rebuildHistorySnapshots } = await import("@/lib/analytics/score");
    const { parseISO } = await import("date-fns");
    const { todayKey } = await import("@/lib/utils");
    const state = createSeededState();
    const rebuilt = rebuildHistorySnapshots(state, 30);
    const yesterday = todayKey(
      new Date(Date.now() - 24 * 60 * 60 * 1000),
    );
    const snap = rebuilt.analyticsSnapshots.find((s) => s.date === yesterday);
    const expected = state.focusSessions
      .filter(
        (s) =>
          s.completedAt && todayKey(parseISO(s.startedAt)) === yesterday,
      )
      .reduce((n, s) => n + s.durationMinutes, 0);
    expect(snap?.focusMinutes).toBe(expected);
  });
});

describe("energyPattern helpers", () => {
  it("maps energy patterns to Focus defaults", () => {
    expect(focusMinutesForEnergy("morning")).toBe(45);
    expect(focusMinutesForEnergy("mixed")).toBe(30);
  });

  it("returns hour-aware guidance copy", () => {
    expect(energyGuidance("morning", 9)).toMatch(/Morning energy/i);
    expect(energyGuidance("evening", 10)).toMatch(/later/i);
  });
});

describe("goalProgressOverTime", () => {
  it("does not treat milestones without completedAt as historically complete", () => {
    const asOf = new Date("2026-08-23T12:00:00.000Z");
    const goals = [
      {
        id: "g1",
        title: "Ship",
        description: "",
        category: "work",
        status: "active" as const,
        targetDate: undefined,
        milestones: [
          { id: "m1", title: "Done", completed: true },
          { id: "m2", title: "Open", completed: false },
        ],
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-23T00:00:00.000Z",
      },
    ];
    const { rows } = goalProgressOverTime(goals as never, 7, asOf);
    const past = rows.find((r) => r.date === "2026-08-20");
    const today = rows.find((r) => r.date === "2026-08-23");
    expect(past?.[`g_g1`]).toBe(0);
    expect(today?.[`g_g1`]).toBe(50);
  });
});

describe("focus session completion claim", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("claims completion only once across callers", async () => {
    const {
      claimFocusCompletion,
      claimExpiredFocusSession,
      writeFocusSessionRaw,
      FOCUS_SESSION_KEY,
    } = await import("@/lib/focus-session");

    writeFocusSessionRaw(
      JSON.stringify({
        minutes: 25,
        remaining: 0,
        timerState: "running",
        endAt: Date.now() - 1000,
        startedAt: new Date().toISOString(),
        taskId: "",
        goalId: "",
      }),
    );

    expect(claimExpiredFocusSession()).not.toBeNull();
    expect(claimFocusCompletion()).toBe(false);
    expect(store.has(FOCUS_SESSION_KEY)).toBe(false);
  });
});
