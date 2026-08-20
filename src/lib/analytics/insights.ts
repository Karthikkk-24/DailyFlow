import type { AnalyticsSnapshot, FocusSession } from "@/types";
import { parseISO, subDays, format, getDay } from "date-fns";
import { todayKey } from "@/lib/utils";

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
  return bestAvg < 0 ? "—" : DAY_NAMES[best];
}

export function mostProductiveHour(sessions: FocusSession[]): string {
  const completed = sessions.filter((s) => s.completedAt);
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

export function sumFocusMinutes(snapshots: AnalyticsSnapshot[]) {
  return snapshots.reduce((n, s) => n + s.focusMinutes, 0);
}
