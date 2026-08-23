import type { AnalyticsSnapshot, AppState, Habit, HabitLog } from "@/types";
import { parseISO, subDays, format, getDay } from "date-fns";
import { todayKey } from "@/lib/utils";

export function isHabitDueOn(habit: Habit, date: Date | string): boolean {
  const d = typeof date === "string" ? parseISO(date) : date;
  if (habit.frequency === "daily") return true;
  return habit.targetDays.includes(getDay(d));
}

export function isHabitCompletedOn(
  habitId: string,
  date: string,
  logs: HabitLog[],
): boolean {
  return logs.some(
    (l) => l.habitId === habitId && l.date === date && l.completed,
  );
}

export function computeStreak(
  habit: Habit,
  logs: HabitLog[],
  asOf = new Date(),
): { current: number; best: number } {
  let current = 0;

  for (let i = 0; i < 400; i++) {
    const day = subDays(asOf, i);
    const key = format(day, "yyyy-MM-dd");
    if (!isHabitDueOn(habit, day)) continue;
    if (isHabitCompletedOn(habit.id, key, logs)) {
      current += 1;
    } else {
      // Allow today incomplete without breaking prior streak
      if (i === 0 && key === todayKey(asOf)) continue;
      break;
    }
  }

  let best = current;
  const habitLogs = logs
    .filter((l) => l.habitId === habit.id && l.completed)
    .map((l) => l.date)
    .sort();
  let streak = 0;
  let prev: Date | null = null;
  for (const dateStr of habitLogs) {
    const d = parseISO(dateStr);
    if (!isHabitDueOn(habit, d)) continue;
    if (!prev) {
      streak = 1;
    } else {
      // count due days between
      let gapOk = true;
      let cursor = subDays(d, 1);
      while (cursor > prev) {
        if (isHabitDueOn(habit, cursor)) {
          gapOk = false;
          break;
        }
        cursor = subDays(cursor, 1);
      }
      streak = gapOk ? streak + 1 : 1;
    }
    best = Math.max(best, streak);
    prev = d;
  }

  return { current, best };
}

export function habitCompletionPercent(
  habit: Habit,
  logs: HabitLog[],
  days = 30,
  asOf = new Date(),
): number {
  let due = 0;
  let done = 0;
  for (let i = 0; i < days; i++) {
    const day = subDays(asOf, i);
    if (!isHabitDueOn(habit, day)) continue;
    due += 1;
    if (isHabitCompletedOn(habit.id, format(day, "yyyy-MM-dd"), logs)) {
      done += 1;
    }
  }
  if (due === 0) return 0;
  return Math.round((done / due) * 100);
}

export function goalProgress(milestones: { completed: boolean }[]): number {
  if (milestones.length === 0) return 0;
  const done = milestones.filter((m) => m.completed).length;
  return Math.round((done / milestones.length) * 100);
}

export function habitsDueToday(habits: Habit[], date = new Date()) {
  return habits.filter((h) => isHabitDueOn(h, date));
}

export function recomputeTodaySnapshot(state: AppState, date = new Date()) {
  const key = todayKey(date);
  const dueHabits = habitsDueToday(state.habits, date);
  const habitsCompleted = dueHabits.filter((h) =>
    isHabitCompletedOn(h.id, key, state.habitLogs),
  ).length;

  const todayTasks = state.tasks.filter(
    (t) => {
      const completedToday =
        t.status === "done" &&
        !!t.completedAt &&
        todayKey(parseISO(t.completedAt)) === key;
      if (completedToday) return true;
      if (t.status === "today" || t.status === "in_progress") return true;
      // Include backlog (and any other non-done) items due today — matches Today UI
      if (t.dueDate === key && t.status !== "done") return true;
      return false;
    },
  );
  const tasksCompleted = state.tasks.filter(
    (t) =>
      t.status === "done" &&
      t.completedAt &&
      todayKey(parseISO(t.completedAt)) === key,
  ).length;
  const plannedTasks = Math.max(todayTasks.length, tasksCompleted);

  const focusMinutes = state.focusSessions
    .filter(
      (s) =>
        s.completedAt && todayKey(parseISO(s.startedAt)) === key,
    )
    .reduce((sum, s) => sum + s.durationMinutes, 0);

  const blocks = state.scheduleBlocks.filter((b) => b.date === key);
  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  const scheduleBlocksCompleted = blocks.filter((b) => {
    const [h, m] = b.endTime.split(":").map(Number);
    return h * 60 + m <= nowMinutes;
  }).length;

  const taskRate =
    plannedTasks === 0 ? 0 : Math.min(1, tasksCompleted / plannedTasks);
  const habitRate =
    dueHabits.length === 0 ? 0 : habitsCompleted / dueHabits.length;
  const focusScore = Math.min(1, focusMinutes / 60);
  const scheduleScore =
    blocks.length === 0 ? 0 : scheduleBlocksCompleted / blocks.length;

  const todayScore = Math.round(
    (taskRate * 0.4 + habitRate * 0.25 + focusScore * 0.2 + scheduleScore * 0.15) *
      100,
  );

  return {
    date: key,
    tasksCompleted,
    habitsCompleted,
    habitsTotal: dueHabits.length,
    focusMinutes,
    scheduleBlocksCompleted,
    todayScore,
    breakdown: {
      tasks: Math.round(taskRate * 100),
      habits: Math.round(habitRate * 100),
      focus: Math.round(focusScore * 100),
      schedule: Math.round(scheduleScore * 100),
      weights: { tasks: 40, habits: 25, focus: 20, schedule: 15 },
    },
  };
}

const MAX_ANALYTICS_SNAPSHOTS = 400;

/** Upsert the analytics row for a specific calendar day (end-of-day for past dates). */
export function upsertSnapshotForDate(
  state: AppState,
  dateKey: string,
  asOf = new Date(),
): AppState {
  const today = todayKey(asOf);
  const at = parseISO(dateKey);
  if (dateKey !== today) {
    at.setHours(23, 59, 59, 999);
  } else {
    // Align wall-clock with "asOf" so schedule scoring matches the live day.
    at.setHours(asOf.getHours(), asOf.getMinutes(), asOf.getSeconds(), asOf.getMilliseconds());
  }
  const snap = toAnalyticsSnapshot(recomputeTodaySnapshot(state, at));
  const others = state.analyticsSnapshots.filter((s) => s.date !== snap.date);
  const next = [...others, snap].sort((a, b) => a.date.localeCompare(b.date));
  return {
    ...state,
    analyticsSnapshots: next.slice(-MAX_ANALYTICS_SNAPSHOTS),
  };
}

export function upsertTodaySnapshot(state: AppState): AppState {
  return upsertSnapshotForDate(state, todayKey());
}

/** Rebuild daily snapshots from entities for the last N days (inclusive of today). */
export function rebuildHistorySnapshots(
  state: AppState,
  days = 30,
  asOf = new Date(),
): AppState {
  const snaps = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = subDays(asOf, i);
    // Evaluate past days at end-of-day so schedule blocks count as completed
    const at = new Date(day);
    if (i > 0) {
      at.setHours(23, 59, 59, 999);
    }
    snaps.push(toAnalyticsSnapshot(recomputeTodaySnapshot(state, at)));
  }
  return {
    ...state,
    analyticsSnapshots: snaps.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function toAnalyticsSnapshot(
  snap: ReturnType<typeof recomputeTodaySnapshot>,
): AnalyticsSnapshot {
  return {
    date: snap.date,
    tasksCompleted: snap.tasksCompleted,
    habitsCompleted: snap.habitsCompleted,
    habitsTotal: snap.habitsTotal,
    focusMinutes: snap.focusMinutes,
    scheduleBlocksCompleted: snap.scheduleBlocksCompleted,
    todayScore: snap.todayScore,
  };
}
