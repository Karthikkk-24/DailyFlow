"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDayFlow } from "@/context/dayflow-provider";
import { Card, PageHeader } from "@/components/ui/card";
import {
  fillRange,
  mostProductiveDay,
  mostProductiveHour,
  snapshotsInRange,
  sumFocusMinutes,
} from "@/lib/analytics/insights";
import { computeStreak } from "@/lib/analytics/score";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

export default function AnalyticsPage() {
  const { state } = useDayFlow();
  const [days, setDays] = useState<7 | 30>(7);

  const data = useMemo(() => {
    const range = snapshotsInRange(state.analyticsSnapshots, days);
    return fillRange(range, days).map((s) => ({
      ...s,
      label: format(parseISO(s.date), days === 7 ? "EEE" : "MMM d"),
      habitPct:
        s.habitsTotal === 0
          ? 0
          : Math.round((s.habitsCompleted / s.habitsTotal) * 100),
    }));
  }, [state.analyticsSnapshots, days]);

  const bestHabit = useMemo(() => {
    let best = { name: "—", streak: 0 };
    for (const h of state.habits) {
      const { current } = computeStreak(h, state.habitLogs);
      if (current > best.streak) best = { name: h.name, streak: current };
    }
    return best;
  }, [state.habits, state.habitLogs]);

  const productiveDay = mostProductiveDay(data);
  const productiveHour = mostProductiveHour(state.focusSessions);
  const focusTotal = sumFocusMinutes(data);

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Productivity trends from your local activity."
        actions={
          <div className="flex rounded-xl bg-muted p-1">
            {([7, 30] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm",
                  days === d && "bg-card shadow-sm",
                )}
              >
                {d} days
              </button>
            ))}
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs uppercase text-muted-foreground">Most productive day</p>
          <p className="mt-2 text-xl font-semibold">{productiveDay}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-muted-foreground">Best focus window</p>
          <p className="mt-2 text-xl font-semibold">{productiveHour}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-muted-foreground">Focus hours</p>
          <p className="mt-2 text-xl font-semibold tabular-nums">
            {(focusTotal / 60).toFixed(1)}h
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-muted-foreground">Best habit streak</p>
          <p className="mt-2 text-xl font-semibold">
            {bestHabit.streak} · {bestHabit.name}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-medium">Tasks completed</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <Tooltip />
                <Bar dataKey="tasksCompleted" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 font-medium">Habit consistency %</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <Tooltip />
                <Line type="monotone" dataKey="habitPct" stroke="var(--accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 font-medium">Focus minutes</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <Tooltip />
                <Bar dataKey="focusMinutes" fill="#7C3AED" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 font-medium">Today score trend</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <Tooltip />
                <Line type="monotone" dataKey="todayScore" stroke="var(--primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <h3 className="mb-2 font-medium">Active goal progress</h3>
        <ul className="space-y-3">
          {state.goals
            .filter((g) => g.status === "active")
            .map((g) => {
              const done = g.milestones.filter((m) => m.completed).length;
              const total = g.milestones.length || 1;
              const pct = Math.round((done / total) * 100);
              return (
                <li key={g.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{g.title}</span>
                    <span className="tabular-nums text-muted-foreground">{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          {state.goals.filter((g) => g.status === "active").length === 0 && (
            <p className="text-sm text-muted-foreground">No active goals.</p>
          )}
        </ul>
      </Card>
    </div>
  );
}
