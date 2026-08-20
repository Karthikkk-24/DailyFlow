"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format, subDays } from "date-fns";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useDayFlow } from "@/context/dayflow-provider";
import { Badge, Card, EmptyState, PageHeader, ProgressRing } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import {
  HabitFormModal,
  type HabitFormValues,
} from "@/components/habits/habit-form-modal";
import { cn, todayKey } from "@/lib/utils";
import {
  computeStreak,
  habitCompletionPercent,
  isHabitCompletedOn,
  isHabitDueOn,
} from "@/lib/analytics/score";

export default function HabitDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { state, dispatch } = useDayFlow();
  const [confirm, setConfirm] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const habit = state.habits.find((h) => h.id === params.id);

  const grid = useMemo(() => {
    if (!habit) return [];
    const cells: { date: string; due: boolean; done: boolean }[] = [];
    for (let i = 83; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const date = format(d, "yyyy-MM-dd");
      cells.push({
        date,
        due: isHabitDueOn(habit, d),
        done: isHabitCompletedOn(habit.id, date, state.habitLogs),
      });
    }
    return cells;
  }, [habit, state.habitLogs]);

  if (!habit) {
    return (
      <EmptyState
        title="Habit not found"
        action={
          <Link href="/habits">
            <Button variant="secondary">Back to habits</Button>
          </Link>
        }
      />
    );
  }

  const { current, best } = computeStreak(habit, state.habitLogs);
  const pct = habitCompletionPercent(habit, state.habitLogs, 30);
  const today = todayKey();
  const doneToday = isHabitCompletedOn(habit.id, today, state.habitLogs);

  function saveEdit(values: HabitFormValues) {
    dispatch({ type: "UPDATE_HABIT", id: habit!.id, patch: values });
  }

  return (
    <div>
      <Link
        href="/habits"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Habits
      </Link>
      <PageHeader
        title={habit.name}
        description={`${habit.frequency === "daily" ? "Daily" : "Weekly"} habit`}
        actions={
          <>
            <Button
              variant={doneToday ? "secondary" : "primary"}
              onClick={() =>
                dispatch({
                  type: "TOGGLE_HABIT_DAY",
                  habitId: habit.id,
                  date: today,
                })
              }
            >
              {doneToday ? "Undo today" : "Complete today"}
            </Button>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button variant="danger" onClick={() => setConfirm(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex flex-col items-center">
          <ProgressRing value={pct} label="30d" />
        </Card>
        <Card>
          <p className="text-xs uppercase text-muted-foreground">Current streak</p>
          <p className="mt-2 text-4xl font-semibold tabular-nums">{current}</p>
          <Badge tone="accent" className="mt-2">days</Badge>
        </Card>
        <Card>
          <p className="text-xs uppercase text-muted-foreground">Best streak</p>
          <p className="mt-2 text-4xl font-semibold tabular-nums">{best}</p>
          <Badge className="mt-2">all time</Badge>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-xl">Last 12 weeks</h2>
        <div className="df-card p-4">
          <div className="grid grid-cols-12 gap-1 sm:grid-cols-[repeat(84,minmax(0,1fr))] sm:gap-0.5">
            {grid.map((cell) => (
              <div
                key={cell.date}
                title={`${cell.date}${cell.done ? " · done" : cell.due ? " · missed" : ""}`}
                className={cn(
                  "aspect-square rounded-[3px]",
                  !cell.due && "bg-muted/40",
                  cell.due && !cell.done && "bg-muted",
                  cell.done && "bg-primary",
                )}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Completion last 30 days: {pct}%
          </p>
        </div>
      </section>

      <HabitFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        habit={habit}
        onSave={saveEdit}
      />

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete habit?"
        description="Logs for this habit will be removed."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          dispatch({ type: "DELETE_HABIT", id: habit.id });
          router.push("/habits");
        }}
      />
    </div>
  );
}
