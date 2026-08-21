import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeStreak,
  goalProgress,
  recomputeTodaySnapshot,
} from "@/lib/analytics/score";
import { parseImportJson } from "@/lib/storage";
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
