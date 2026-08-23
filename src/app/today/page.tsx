"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Check,
  Flame,
  Plus,
  Target,
  Timer,
} from "lucide-react";
import { useDayFlow } from "@/context/dayflow-provider";
import {
  Card,
  EmptyState,
  PageHeader,
  ProgressRing,
  Badge,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  formatDisplayDate,
  greetingForHour,
  energyGuidance,
  todayKey,
  cn,
  timeToMinutes,
} from "@/lib/utils";
import { useTodayKey } from "@/hooks/use-today-key";
import { parseISO } from "date-fns";
import { recomputeTodaySnapshot, computeStreak, goalProgress, isHabitCompletedOn, habitsDueToday } from "@/lib/analytics/score";
import { Modal } from "@/components/ui/modal";
import { FieldError, Input, Label } from "@/components/ui/input";
import { TASK_CATEGORIES, type TaskPriority } from "@/types";

function blockPhase(startTime: string, endTime: string, now = new Date()) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (nowMin >= end) return "past" as const;
  if (nowMin >= start && nowMin < end) return "current" as const;
  return "upcoming" as const;
}

export default function TodayPage() {
  const { state, dispatch } = useDayFlow();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  const [today, tick] = useTodayKey();
  // Re-render every minute via `tick` so wall-clock schedule phases/scores refresh.
  void tick;
  const now = new Date();
  const snap = recomputeTodaySnapshot(state, now);
  const hour = now.getHours();
  const greeting = greetingForHour(hour);
  const energyTip = energyGuidance(state.profile.energyPattern, hour);

  const todayTasks = state.tasks
    .filter(
      (t) =>
        t.status === "today" ||
        t.status === "in_progress" ||
        (t.dueDate === today && t.status !== "done") ||
        (t.status === "done" &&
          !!t.completedAt &&
          todayKey(parseISO(t.completedAt)) === today),
    )
    .sort((a, b) => {
      const rank = { in_progress: 0, today: 1, done: 2, backlog: 3 };
      return rank[a.status] - rank[b.status] || a.order - b.order;
    });

  const blocks = state.scheduleBlocks
    .filter((b) => b.date === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const dueHabits = habitsDueToday(state.habits);
  const activeGoals = state.goals.filter((g) => g.status === "active").slice(0, 2);

  function addTask() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    dispatch({
      type: "ADD_TASK",
      task: {
        title: title.trim(),
        status: "today",
        priority: "medium" as TaskPriority,
        category: TASK_CATEGORIES[0],
        dueDate: today,
      },
    });
    setTitle("");
    setError("");
    setOpen(false);
  }

  return (
    <div>
      <PageHeader
        title={`${greeting}, ${state.profile.name}`}
        description={formatDisplayDate(new Date())}
        actions={
          <>
            <Button variant="secondary" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Task
            </Button>
            <Button asChild>
              <Link href="/focus">
                <Timer className="h-4 w-4" /> Focus
              </Link>
            </Button>
          </>
        }
      />

      {state.profile.primaryGoal && (
        <p className="mb-2 text-sm text-muted-foreground">
          Focus: <span className="text-foreground">{state.profile.primaryGoal}</span>
        </p>
      )}
      <p className="mb-6 text-sm text-muted-foreground">{energyTip}</p>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Card className="flex flex-col items-center justify-center gap-2">
          <button
            type="button"
            className="group relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            aria-describedby="today-score-breakdown"
            title={`Tasks ${snap.breakdown.tasks}% (40%) · Habits ${snap.breakdown.habits}% (25%) · Focus ${snap.breakdown.focus}% (20%) · Schedule ${snap.breakdown.schedule}% (15%)`}
          >
            <ProgressRing value={snap.todayScore} label="Today" />
            <div
              id="today-score-breakdown"
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden w-56 -translate-x-1/2 rounded-xl border border-border bg-card p-3 text-left text-xs shadow-lg group-hover:block group-focus:block group-focus-visible:block"
            >
              <p className="mb-2 font-medium text-foreground">Score breakdown</p>
              <ul className="space-y-1 text-muted-foreground">
                <li className="flex justify-between gap-2">
                  <span>Tasks (40%)</span>
                  <span className="tabular-nums text-foreground">
                    {snap.breakdown.tasks}%
                  </span>
                </li>
                <li className="flex justify-between gap-2">
                  <span>Habits (25%)</span>
                  <span className="tabular-nums text-foreground">
                    {snap.breakdown.habits}%
                  </span>
                </li>
                <li className="flex justify-between gap-2">
                  <span>Focus (20%)</span>
                  <span className="tabular-nums text-foreground">
                    {snap.breakdown.focus}%
                  </span>
                </li>
                <li className="flex justify-between gap-2">
                  <span>Schedule (15%)</span>
                  <span className="tabular-nums text-foreground">
                    {snap.breakdown.schedule}%
                  </span>
                </li>
              </ul>
            </div>
          </button>
          <details className="w-full text-center text-xs text-muted-foreground sm:hidden">
            <summary className="cursor-pointer">Score breakdown</summary>
            <ul className="mt-2 space-y-1 text-left">
              <li>Tasks 40% → {snap.breakdown.tasks}%</li>
              <li>Habits 25% → {snap.breakdown.habits}%</li>
              <li>Focus 20% → {snap.breakdown.focus}%</li>
              <li>Schedule 15% → {snap.breakdown.schedule}%</li>
            </ul>
          </details>
          <p className="hidden text-center text-xs text-muted-foreground sm:block">
            Hover or focus the ring for weighted breakdown
          </p>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Tasks done</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{snap.tasksCompleted}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Habits</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {snap.habitsCompleted}/{snap.habitsTotal || 0}
            </p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Focus</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{snap.focusMinutes}m</p>
          </Card>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-xl">Today&apos;s tasks</h2>
        {todayTasks.length === 0 ? (
          <EmptyState
            title="Nothing on your plate"
            description="Add a task or move something from backlog into Today."
            action={
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> Add task
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {todayTasks.map((task) => (
              <li
                key={task.id}
                className="df-card flex items-center gap-3 p-3"
              >
                <button
                  type="button"
                  aria-label={task.status === "done" ? "Mark incomplete" : "Complete"}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border",
                    task.status === "done"
                      ? "border-success bg-success text-white"
                      : "border-border hover:border-primary",
                  )}
                  onClick={() =>
                    dispatch({
                      type: "MOVE_TASK",
                      id: task.id,
                      status:
                        task.status === "done"
                          ? (task.previousStatus ?? "today")
                          : "done",
                    })
                  }
                >
                  {task.status === "done" && <Check className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => router.push(`/tasks?edit=${task.id}`)}
                >
                  <p
                    className={cn(
                      "truncate font-medium",
                      task.status === "done" && "text-muted-foreground line-through",
                    )}
                  >
                    {task.title}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge tone={task.priority}>{task.priority}</Badge>
                    <Badge>{task.category}</Badge>
                    {task.dueTime && (
                      <span className="text-xs text-muted-foreground">{task.dueTime}</span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-display text-xl">Schedule</h2>
          {blocks.length === 0 ? (
            <EmptyState
              title="No blocks today"
              description="Plan your day in the weekly planner."
              action={
                <Button asChild variant="secondary">
                  <Link href="/planner">Open planner</Link>
                </Button>
              }
            />
          ) : (
            <ol className="relative space-y-3 border-l border-border pl-4">
              {blocks.map((b) => {
                const phase = blockPhase(b.startTime, b.endTime, now);
                return (
                  <li key={b.id} className="relative">
                    <span
                      className={cn(
                        "absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full",
                        phase === "past" && "bg-muted-foreground/40",
                        phase === "current" && "bg-primary ring-4 ring-primary/20",
                        phase === "upcoming" && "bg-primary",
                      )}
                    />
                    <div
                      className={cn(
                        "df-card p-3 transition",
                        phase === "past" && "opacity-55",
                        phase === "current" && "ring-2 ring-primary/40",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          {b.startTime} – {b.endTime}
                        </p>
                        {phase === "current" && (
                          <Badge tone="primary">Now</Badge>
                        )}
                        {phase === "past" && (
                          <Badge tone="neutral">Done</Badge>
                        )}
                      </div>
                      <p
                        className={cn(
                          "font-medium",
                          phase === "past" && "text-muted-foreground",
                        )}
                      >
                        {b.title}
                      </p>
                      <Badge className="mt-1">
                        {b.category.replace("_", " ")}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="mb-3 font-display text-xl">Habit streaks</h2>
            {state.habits.length === 0 ? (
              <EmptyState title="No habits yet" action={<Button asChild variant="secondary"><Link href="/habits">Add habits</Link></Button>} />
            ) : dueHabits.length === 0 ? (
              <EmptyState
                title="No habits due today"
                description="You have habits, but none are scheduled for today. Check the Habits page for streaks."
                action={<Button asChild variant="secondary"><Link href="/habits">View habits</Link></Button>}
              />
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {dueHabits.map((h) => {
                  const { current } = computeStreak(h, state.habitLogs);
                  const done = isHabitCompletedOn(h.id, today, state.habitLogs);
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() =>
                        dispatch({
                          type: "TOGGLE_HABIT_DAY",
                          habitId: h.id,
                          date: today,
                        })
                      }
                      className={cn(
                        "df-card min-w-[140px] p-3 text-left transition",
                        done && "ring-2 ring-primary/40",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Flame className="h-4 w-4 text-accent" style={{ color: h.color }} />
                        <span className="truncate text-sm font-medium">{h.name}</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {current} day streak · {done ? "Done" : "Tap to log"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 font-display text-xl">Goal progress</h2>
            {activeGoals.length === 0 ? (
              <EmptyState title="No active goals" action={<Button asChild variant="secondary"><Link href="/goals">Set a goal</Link></Button>} />
            ) : (
              <div className="space-y-3">
                {activeGoals.map((g) => {
                  const pct = goalProgress(g.milestones);
                  return (
                    <Link key={g.id} href={`/goals/${g.id}`} className="df-card block p-4 hover:bg-muted/40">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary" />
                          <span className="font-medium">{g.title}</span>
                        </div>
                        <span className="text-sm tabular-nums text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title="Add task for today">
        <div className="space-y-3">
          <div>
            <Label htmlFor="quick-title">Title</Label>
            <Input
              id="quick-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              maxLength={200}
            />
            <FieldError>{error}</FieldError>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addTask}>Add task</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
