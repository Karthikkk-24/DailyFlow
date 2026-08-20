import { describe, expect, it } from "vitest";
import {
  computeStreak,
  goalProgress,
  recomputeTodaySnapshot,
} from "@/lib/analytics/score";
import { parseImportJson } from "@/lib/storage";
import { createSeededState } from "@/lib/seed/demo-data";
import type { AppState, Habit, HabitLog } from "@/types";
import { format, subDays } from "date-fns";

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
