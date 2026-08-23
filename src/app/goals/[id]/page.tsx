"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { ArrowLeft, Check, Pencil, Trash2 } from "lucide-react";
import { useDayFlow } from "@/context/dayflow-provider";
import { Badge, EmptyState, PageHeader, ProgressRing } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { FieldError, Select } from "@/components/ui/input";
import {
  GoalFormModal,
  type GoalFormValues,
} from "@/components/goals/goal-form-modal";
import { goalProgress } from "@/lib/analytics/score";
import { cn } from "@/lib/utils";
import type { GoalStatus } from "@/types";

export default function GoalDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { state, dispatch } = useDayFlow();
  const [confirm, setConfirm] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [statusError, setStatusError] = useState("");
  const goal = state.goals.find((g) => g.id === params.id);

  if (!goal) {
    return (
      <EmptyState
        title="Goal not found"
        action={
          <Button asChild variant="secondary">
            <Link href="/goals">Back to goals</Link>
          </Button>
        }
      />
    );
  }

  const pct = goalProgress(goal.milestones);
  const daysLeft = goal.targetDate
    ? differenceInCalendarDays(parseISO(goal.targetDate), new Date())
    : null;

  function saveEdit(values: GoalFormValues) {
    dispatch({
      type: "UPDATE_GOAL",
      id: goal!.id,
      patch: values,
    });
  }

  return (
    <div>
      <Link
        href="/goals"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Goals
      </Link>

      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(800px 300px at 0% 0%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 60%), radial-gradient(600px 280px at 100% 20%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 55%)",
          }}
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge tone="primary">{goal.category}</Badge>
            <h1 className="mt-3 font-display text-4xl tracking-tight">{goal.title}</h1>
            {goal.description && (
              <p className="mt-2 max-w-xl text-muted-foreground">{goal.description}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
              {goal.targetDate && (
                <span>
                  Target {goal.targetDate}
                  {daysLeft !== null &&
                    ` · ${daysLeft >= 0 ? `${daysLeft} days left` : `${Math.abs(daysLeft)} days overdue`}`}
                </span>
              )}
            </div>
          </div>
          <ProgressRing value={pct} size={128} stroke={10} label="progress" />
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted-foreground" htmlFor="gstatus">
            Status
          </label>
          <Select
            id="gstatus"
            className="w-40"
            value={goal.status}
            onChange={(e) => {
              const next = e.target.value as GoalStatus;
              const openMilestones =
                goal.milestones.length > 0 &&
                goal.milestones.some((m) => !m.completed);
              if (next === "completed" && openMilestones) {
                setStatusError(
                  "Complete all milestones before marking this goal completed.",
                );
                return;
              }
              setStatusError("");
              dispatch({
                type: "UPDATE_GOAL",
                id: goal.id,
                patch: { status: next },
              });
            }}
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </Select>
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
        <FieldError>{statusError}</FieldError>
      </div>

      <section className="mt-8">
        <PageHeader
          title="Milestones"
          description="Mark milestones to update progress automatically."
          actions={
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              Manage milestones
            </Button>
          }
        />
        {goal.milestones.length === 0 ? (
          <EmptyState
            title="No milestones"
            description="Add milestones to track progress."
            action={
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                Add milestones
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {goal.milestones.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "TOGGLE_MILESTONE",
                      goalId: goal.id,
                      milestoneId: m.id,
                    })
                  }
                  className="df-card flex w-full items-center gap-3 p-4 text-left transition hover:bg-muted/30"
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border",
                      m.completed
                        ? "border-success bg-success text-white"
                        : "border-border",
                    )}
                  >
                    {m.completed && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      m.completed && "text-muted-foreground line-through",
                    )}
                  >
                    {m.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <GoalFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        goal={goal}
        onSave={saveEdit}
      />

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete goal?"
        description="This removes the goal and its milestones."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          dispatch({ type: "DELETE_GOAL", id: goal.id });
          router.push("/goals");
        }}
      />
    </div>
  );
}
