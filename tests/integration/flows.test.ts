import { describe, expect, it } from "vitest";
import { dayFlowReducer } from "@/context/dayflow-reducer";
import { createSeededState } from "@/lib/seed/demo-data";
import { computeStreak, recomputeTodaySnapshot } from "@/lib/analytics/score";
import { parseImportJson } from "@/lib/storage";
import { todayKey } from "@/lib/utils";
import { addDays, format, parseISO, subDays } from "date-fns";

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

describe("integration: midnight rollover", () => {
  it("demotes stale in_progress tasks to backlog", () => {
    const base = createSeededState();
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
    const stale = {
      ...base,
      tasks: base.tasks.map((t, i) =>
        i === 0
          ? {
              ...t,
              status: "in_progress" as const,
              updatedAt: `${yesterday}T12:00:00.000Z`,
            }
          : t,
      ),
    };
    const next = dayFlowReducer(stale, {
      type: "ROLLOVER_STALE_TODAY",
      today: todayKey(),
    });
    expect(next.tasks[0]?.status).toBe("backlog");
  });
  it("demotes stale today tasks with future due date to backlog", () => {
    const base = createSeededState();
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
    const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
    const stale = {
      ...base,
      tasks: [
        {
          id: "task-future-today",
          title: "Future due but left on Today",
          status: "today" as const,
          priority: "medium" as const,
          category: "Work",
          dueDate: tomorrow,
          createdAt: `${yesterday}T12:00:00.000Z`,
          updatedAt: `${yesterday}T12:00:00.000Z`,
          order: 0,
        },
      ],
    };
    const next = dayFlowReducer(stale, {
      type: "ROLLOVER_STALE_TODAY",
      today: todayKey(),
    });
    expect(next.tasks[0]?.status).toBe("backlog");
  });

});

describe("integration: today overdue backlog", () => {
  it("includes overdue backlog tasks in today task set for display", () => {
    const base = createSeededState();
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
    const key = todayKey();
    const withOverdue = {
      ...base,
      tasks: [
        ...base.tasks,
        {
          id: "task-overdue",
          title: "Overdue backlog",
          status: "backlog" as const,
          priority: "high" as const,
          category: "Work",
          dueDate: yesterday,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          order: 99,
        },
      ],
    };
    const visible = withOverdue.tasks.filter(
      (t) =>
        t.status === "today" ||
        t.status === "in_progress" ||
        (t.dueDate === key && t.status !== "done") ||
        (t.status === "backlog" && !!t.dueDate && t.dueDate < key) ||
        (t.status === "done" &&
          !!t.completedAt &&
          todayKey(parseISO(t.completedAt)) === key),
    );
    expect(visible.some((t) => t.id === "task-overdue")).toBe(true);
    const snap = recomputeTodaySnapshot(withOverdue);
    const snapWith = recomputeTodaySnapshot({
      ...withOverdue,
      tasks: withOverdue.tasks.filter((t) => t.id !== "task-overdue"),
    });
    expect(snap.todayScore).toBe(snapWith.todayScore);
  });
});

describe("integration: completed goal status dropdown", () => {
  it("keeps active or paused when user changes status on a completed goal", () => {
    const base = createSeededState();
    const goal = base.goals[0];
    const completed = {
      ...goal,
      status: "completed" as const,
      reopenStatus: "active" as const,
      milestones: goal.milestones.map((m) => ({
        ...m,
        completed: true,
        completedAt: m.completedAt ?? new Date().toISOString(),
      })),
    };
    const state = {
      ...base,
      goals: base.goals.map((g) => (g.id === goal.id ? completed : g)),
    };

    const active = dayFlowReducer(state, {
      type: "UPDATE_GOAL",
      id: goal.id,
      patch: { status: "active" },
    });
    expect(active.goals.find((g) => g.id === goal.id)?.status).toBe("active");

    const paused = dayFlowReducer(active, {
      type: "UPDATE_GOAL",
      id: goal.id,
      patch: { status: "paused" },
    });
    expect(paused.goals.find((g) => g.id === goal.id)?.status).toBe("paused");
  });

  it("blocks completed status while milestones remain open", () => {
    const base = createSeededState();
    const goal = base.goals[0];
    const withOpen = {
      ...goal,
      status: "active" as const,
      milestones: goal.milestones.map((m, i) => ({
        ...m,
        completed: i === 0,
        completedAt: i === 0 ? new Date().toISOString() : undefined,
      })),
    };
    const state = {
      ...base,
      goals: base.goals.map((g) => (g.id === goal.id ? withOpen : g)),
    };

    const next = dayFlowReducer(state, {
      type: "UPDATE_GOAL",
      id: goal.id,
      patch: { status: "completed" },
    });
    expect(next.goals.find((g) => g.id === goal.id)?.status).toBe("active");
  });
});

