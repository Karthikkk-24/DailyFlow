import type { AppState, Habit, HabitLog } from "@/types";
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
  let best = 0;
  let run = 0;

  // Walk back ~400 days for best streak; current breaks on first miss
  for (let i = 0; i < 400; i++) {
    const day = subDays(asOf, i);
    const key = format(day, "yyyy-MM-dd");
    if (!isHabitDueOn(habit, day)) continue;

    const done = isHabitCompletedOn(habit.id, key, logs);
    if (done) {
      run += 1;
      best = Math.max(best, run);
      if (i === current || (current === 0 && i === 0) || run === current + 1) {
        // continue building current from today backward
      }
    } else {
      if (i === 0 || (current === 0 && run === 0 && key === todayKey(asOf))) {
        // miss today — current stays 0 until we find consecutive past
      }
      if (current === 0 && run > 0 && i > 0) {
        current = run;
      }
      if (current > 0 || i > 0) {
        if (current === 0) current = run;
        run = 0;
        if (current > 0 && i > 0) break;
      }
      run = 0;
    }
  }

  // Simpler accurate walk for current streak
  current = 0;
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

  // Best streak: scan all logs chronologically
  best = Math.max(best, current);
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
    (t) =>
      t.status === "today" ||
      t.status === "in_progress" ||
      t.status === "done" ||
      t.dueDate === key,
  );
  const tasksCompleted = state.tasks.filter(
    (t) =>
      t.status === "done" &&
      t.completedAt &&
      todayKey(parseISO(t.completedAt)) === key,
  ).length;
  const plannedTasks = Math.max(
    todayTasks.filter((t) => t.status !== "backlog").length,
    tasksCompleted,
  );

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
  };
}

export function upsertTodaySnapshot(state: AppState): AppState {
  const snap = recomputeTodaySnapshot(state);
  const others = state.analyticsSnapshots.filter((s) => s.date !== snap.date);
  return {
    ...state,
    analyticsSnapshots: [...others, snap].sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
  };
}
