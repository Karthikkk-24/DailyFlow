"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { addDays, format, startOfDay, startOfWeek, subWeeks } from "date-fns";
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
    const today = startOfDay(new Date());
    // 12 Monday-start calendar weeks ending with the week that contains today.
    const rangeStart = startOfWeek(subWeeks(today, 11), { weekStartsOn: 1 });
    const cells: {
      date: string;
      due: boolean;
      done: boolean;
      future: boolean;
    }[] = [];
    for (let i = 0; i < 84; i++) {
      const d = addDays(rangeStart, i);
      const date = format(d, "yyyy-MM-dd");
      const future = d > today;
      cells.push({
        date,
        due: !future && isHabitDueOn(habit, d),
        done: !future && isHabitCompletedOn(habit.id, date, state.habitLogs),
        future,
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
  const dueToday = isHabitDueOn(habit, new Date());
  const canToggleToday = dueToday || doneToday;

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
        description={`${habit.frequency === "daily" ? "Daily" : "Weekly"} habit${!dueToday ? " · not due today" : ""}`}
        actions={
          <>
            <Button
              variant={doneToday ? "secondary" : "primary"}
              disabled={!canToggleToday}
              title={!dueToday && !doneToday ? "Not due today" : undefined}
              onClick={() => {
                if (!canToggleToday) return;
                dispatch({
                  type: "TOGGLE_HABIT_DAY",
                  habitId: habit.id,
                  date: today,
                });
              }}
            >
              {doneToday ? "Undo today" : dueToday ? "Complete today" : "Not due today"}
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
          <div className="flex gap-1 overflow-x-auto pb-1">
            {Array.from({ length: 12 }, (_, week) => (
              <div
                key={week}
                className="flex shrink-0 flex-col gap-1"
                aria-label={`Week ${week + 1} of 12`}
              >
                {grid.slice(week * 7, week * 7 + 7).map((cell) => {
                  const canToggle = !cell.future && (cell.due || cell.done);
                  return (
                    <button
                      key={cell.date}
                      type="button"
                      disabled={!canToggle}
                      title={`${cell.date}${cell.future ? " · future" : cell.done ? " · done" : cell.due ? " · missed" : " · not due"}`}
                      aria-label={
                        cell.future
                          ? `${cell.date} future`
                          : cell.done
                            ? `Mark ${cell.date} incomplete`
                            : cell.due
                              ? `Mark ${cell.date} complete`
                              : `${cell.date} not due`
                      }
                      onClick={() => {
                        if (!canToggle) return;
                        dispatch({
                          type: "TOGGLE_HABIT_DAY",
                          habitId: habit.id,
                          date: cell.date,
                        });
                      }}
                      className={cn(
                        "h-3 w-3 rounded-[3px] sm:h-3.5 sm:w-3.5",
                        canToggle && "cursor-pointer hover:ring-2 hover:ring-primary/40",
                        !canToggle && "cursor-default",
                        cell.future && "bg-transparent ring-1 ring-border/40",
                        !cell.future && !cell.due && "bg-muted/40",
                        !cell.future && cell.due && !cell.done && "bg-muted",
                        !cell.future && cell.done && "bg-primary",
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Completion last 30 days: {pct}% · Mon–Sun weeks · click a due day to toggle
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
