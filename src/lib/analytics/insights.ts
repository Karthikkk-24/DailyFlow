import type { AnalyticsSnapshot, EnergyPattern, FocusSession, Goal } from "@/types";
import { parseISO, subDays, format, getDay } from "date-fns";
import { todayKey } from "@/lib/utils";
import { goalProgress } from "@/lib/analytics/score";

export function snapshotsInRange(
  snapshots: AnalyticsSnapshot[],
  days: 7 | 30,
  asOf = new Date(),
) {
  const start = todayKey(subDays(asOf, days - 1));
  const end = todayKey(asOf);
  return snapshots
    .filter((s) => s.date >= start && s.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function fillRange(
  snapshots: AnalyticsSnapshot[],
  days: 7 | 30,
  asOf = new Date(),
): AnalyticsSnapshot[] {
  const map = new Map(snapshots.map((s) => [s.date, s]));
  const result: AnalyticsSnapshot[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = format(subDays(asOf, i), "yyyy-MM-dd");
    result.push(
      map.get(key) ?? {
        date: key,
        tasksCompleted: 0,
        habitsCompleted: 0,
        habitsTotal: 0,
        focusMinutes: 0,
        scheduleBlocksCompleted: 0,
        todayScore: 0,
      },
    );
  }
  return result;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function mostProductiveDay(snapshots: AnalyticsSnapshot[]): string {
  if (snapshots.length === 0) return "—";
  const scores = new Array(7).fill(0);
  const counts = new Array(7).fill(0);
  for (const s of snapshots) {
    const d = getDay(parseISO(s.date));
    scores[d] += s.todayScore;
    counts[d] += 1;
  }
  let best = 0;
  let bestAvg = -1;
  for (let i = 0; i < 7; i++) {
    if (counts[i] === 0) continue;
    const avg = scores[i] / counts[i];
    if (avg > bestAvg) {
      bestAvg = avg;
      best = i;
    }
  }
  return bestAvg <= 0 ? "—" : DAY_NAMES[best];
}

export function mostProductiveHour(
  sessions: FocusSession[],
  days?: 7 | 30,
  asOf = new Date(),
): string {
  let completed = sessions.filter((s) => s.completedAt);
  if (days) {
    const start = todayKey(subDays(asOf, days - 1));
    completed = completed.filter(
      (s) => todayKey(parseISO(s.startedAt)) >= start,
    );
  }
  if (completed.length === 0) return "—";
  const buckets = new Array(24).fill(0);
  for (const s of completed) {
    buckets[parseISO(s.startedAt).getHours()] += s.durationMinutes;
  }
  let best = 0;
  for (let i = 0; i < 24; i++) {
    if (buckets[i] > buckets[best]) best = i;
  }
  const end = (best + 1) % 24;
  return `${String(best).padStart(2, "0")}:00–${String(end).padStart(2, "0")}:00`;
}

/** Compare declared energy pattern to observed best focus hour. */
export function energyAlignmentNote(
  pattern: EnergyPattern,
  productiveHourLabel: string,
): string {
  if (productiveHourLabel === "—") {
    return `Declared energy: ${pattern}. Complete a Focus session to compare.`;
  }
  const hour = Number.parseInt(productiveHourLabel.slice(0, 2), 10);
  if (!Number.isFinite(hour)) {
    return `Declared energy: ${pattern}.`;
  }
  const observed =
    hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  if (pattern === "mixed") {
    return `Best focus window ${productiveHourLabel} — matches a flexible energy pattern.`;
  }
  if (pattern === observed) {
    return `Best focus window ${productiveHourLabel} aligns with your ${pattern} energy.`;
  }
  return `Best focus window ${productiveHourLabel}; you marked ${pattern} energy — consider shifting deep work.`;
}

export function sumFocusMinutes(snapshots: AnalyticsSnapshot[]) {
  return snapshots.reduce((n, s) => n + s.focusMinutes, 0);
}

const GOAL_LINE_COLORS = [
  "var(--primary)",
  "var(--accent)",
  "#7C3AED",
  "#2563EB",
  "#16A34A",
];

/** Progress % for each goal as of end-of-day for each date in range. */
export function goalProgressOverTime(
  goals: Goal[],
  days: 7 | 30,
  asOf = new Date(),
): {
  rows: Record<string, string | number>[];
  series: { key: string; name: string; color: string }[];
} {
  const tracked = goals
    .filter((g) => g.status === "active" || g.status === "completed" || g.status === "paused")
    .slice(0, 5);

  const series = tracked.map((g, i) => ({
    key: `g_${g.id}`,
    name: g.title,
    color: GOAL_LINE_COLORS[i % GOAL_LINE_COLORS.length],
  }));

  const rows: Record<string, string | number>[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = subDays(asOf, i);
    const key = format(day, "yyyy-MM-dd");
    const row: Record<string, string | number> = {
      date: key,
      label: format(day, days === 7 ? "EEE" : "MMM d"),
    };
    for (const g of tracked) {
      const normalized = g.milestones.map((m) => {
        if (!m.completed) return { completed: false };
        if (!m.completedAt) return { completed: true };
        return { completed: todayKey(parseISO(m.completedAt)) <= key };
      });
      row[`g_${g.id}`] = goalProgress(normalized);
    }
    rows.push(row);
  }

  return { rows, series };
}
