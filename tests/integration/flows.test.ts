import { describe, expect, it } from "vitest";
import { dayFlowReducer } from "@/context/dayflow-reducer";
import { createSeededState } from "@/lib/seed/demo-data";
import { computeStreak, recomputeTodaySnapshot } from "@/lib/analytics/score";
import { parseImportJson } from "@/lib/storage";
import { todayKey } from "@/lib/utils";
import { format, subDays } from "date-fns";

describe("integration: task complete → analytics", () => {
  it("marks a today task done and updates the today snapshot score inputs", () => {
    const base = createSeededState();
    const task = base.tasks.find((t) => t.status === "today" || t.status === "in_progress");
    expect(task).toBeDefined();
    if (!task) return;

    const next = dayFlowReducer(base, {
      type: "MOVE_TASK",
      id: task.id,
      status: "done",
    });

    const done = next.tasks.find((t) => t.id === task.id);
    expect(done?.status).toBe("done");
    expect(done?.completedAt).toBeTruthy();

    const today = todayKey();
    const snap = next.analyticsSnapshots.find((s) => s.date === today);
    expect(snap).toBeDefined();
    expect(snap!.tasksCompleted).toBeGreaterThanOrEqual(1);

    const live = recomputeTodaySnapshot(next);
    expect(live.tasksCompleted).toBe(snap!.tasksCompleted);
    expect(live.todayScore).toBe(snap!.todayScore);
  });
});

describe("integration: onboarding skip", () => {
  it("marks onboarding complete without wiping seeded data", () => {
    const base = createSeededState();
    const unfinished = {
      ...base,
      meta: { ...base.meta, onboardingCompleted: false },
    };
    const next = dayFlowReducer(unfinished, { type: "SKIP_ONBOARDING" });
    expect(next.meta.onboardingCompleted).toBe(true);
    expect(next.tasks.length).toBe(base.tasks.length);
    expect(next.habits.length).toBe(base.habits.length);
  });
});

describe("integration: export / import round-trip", () => {
  it("rehydrates a serialized export through parseImportJson", () => {
    const base = createSeededState();
    const exported = JSON.stringify(base);
    const result = parseImportJson(exported);
    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    if (!result.data) return;

    const replaced = dayFlowReducer(base, {
      type: "REPLACE_STATE",
      state: result.data,
    });
    expect(replaced.version).toBe(1);
    expect(replaced.tasks).toHaveLength(base.tasks.length);
    expect(replaced.profile.name).toBe(base.profile.name);
    expect(replaced.meta.focusTickSound).toBe(false);
  });
});

describe("integration: habit toggle → streak", () => {
  it("increments current streak when toggling due days complete", () => {
    const base = createSeededState();
    const habit = base.habits.find((h) => h.frequency === "daily");
    expect(habit).toBeDefined();
    if (!habit) return;

    // Clear existing logs for a clean streak
    let state = { ...base, habitLogs: base.habitLogs.filter((l) => l.habitId !== habit.id) };
    expect(computeStreak(habit, state.habitLogs).current).toBe(0);

    const today = new Date();
    for (let i = 2; i >= 0; i--) {
      const date = format(subDays(today, i), "yyyy-MM-dd");
      state = dayFlowReducer(state, {
        type: "TOGGLE_HABIT_DAY",
        habitId: habit.id,
        date,
      });
    }

    const { current } = computeStreak(habit, state.habitLogs, today);
    expect(current).toBeGreaterThanOrEqual(3);
    expect(
      state.habitLogs.filter((l) => l.habitId === habit.id && l.completed),
    ).toHaveLength(3);
  });
});
