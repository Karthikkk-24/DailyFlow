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

describe("integration: undo complete restores previous status", () => {
  it("restores in_progress when undoing completion", () => {
    const base = createSeededState();
    const task = base.tasks[0];
    const withProgress = {
      ...base,
      tasks: base.tasks.map((t) =>
        t.id === task.id ? { ...t, status: "in_progress" as const } : t,
      ),
    };
    const done = dayFlowReducer(withProgress, {
      type: "MOVE_TASK",
      id: task.id,
      status: "done",
    });
    expect(done.tasks.find((t) => t.id === task.id)?.previousStatus).toBe(
      "in_progress",
    );
    const undone = dayFlowReducer(done, {
      type: "MOVE_TASK",
      id: task.id,
      status: "in_progress",
    });
    const restored = undone.tasks.find((t) => t.id === task.id);
    expect(restored?.status).toBe("in_progress");
    expect(restored?.previousStatus).toBeUndefined();
    expect(restored?.completedAt).toBeUndefined();
  });
});

describe("integration: hydrate refreshes today snapshot", () => {
  it("recomputes today's analytics row on HYDRATE and REPLACE_STATE", () => {
    const base = createSeededState();
    const today = todayKey();
    const stale: typeof base = {
      ...base,
      analyticsSnapshots: base.analyticsSnapshots.map((s) =>
        s.date === today ? { ...s, todayScore: 0, focusMinutes: 0 } : s,
      ),
    };
    const hydrated = dayFlowReducer(stale, { type: "HYDRATE", state: stale });
    const live = recomputeTodaySnapshot(stale);
    const snap = hydrated.analyticsSnapshots.find((s) => s.date === today);
    expect(snap?.todayScore).toBe(live.todayScore);
    expect(snap?.focusMinutes).toBe(live.focusMinutes);

    const replaced = dayFlowReducer(base, {
      type: "REPLACE_STATE",
      state: stale,
    });
    const replacedSnap = replaced.analyticsSnapshots.find((s) => s.date === today);
    expect(replacedSnap?.todayScore).toBe(live.todayScore);
  });
});
