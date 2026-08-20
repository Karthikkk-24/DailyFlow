"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useDayFlow } from "@/context/dayflow-provider";
import { Badge, EmptyState, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  GoalFormModal,
  type GoalFormValues,
} from "@/components/goals/goal-form-modal";
import { goalProgress } from "@/lib/analytics/score";
import type { GoalStatus } from "@/types";

export default function GoalsPage() {
  const { state, dispatch } = useDayFlow();
  const [tab, setTab] = useState<GoalStatus | "all">("active");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () =>
      state.goals.filter((g) => (tab === "all" ? true : g.status === tab)),
    [state.goals, tab],
  );

  function save(values: GoalFormValues) {
    dispatch({
      type: "ADD_GOAL",
      goal: {
        ...values,
        status: "active",
      },
    });
  }

  return (
    <div>
      <PageHeader
        title="Goals"
        description="Long-term outcomes with milestone progress."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New goal
          </Button>
        }
      />

      <div className="mb-5 flex w-fit flex-wrap gap-1 rounded-xl bg-muted p-1">
        {(["active", "paused", "completed", "all"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
              tab === t ? "bg-card shadow-sm" : ""
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No goals here"
          description="Create a goal with milestones to track progress."
          action={<Button onClick={() => setOpen(true)}>New goal</Button>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((goal) => {
            const pct = goalProgress(goal.milestones);
            return (
              <li key={goal.id}>
                <Link
                  href={`/goals/${goal.id}`}
                  className="df-card block p-5 hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium">{goal.title}</h3>
                    <Badge
                      tone={
                        goal.status === "completed"
                          ? "success"
                          : goal.status === "paused"
                            ? "neutral"
                            : "primary"
                      }
                    >
                      {goal.status}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {goal.description || goal.category}
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {pct}% · {goal.milestones.filter((m) => m.completed).length}/
                    {goal.milestones.length} milestones
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <GoalFormModal
        open={open}
        onClose={() => setOpen(false)}
        onSave={save}
      />
    </div>
  );
}
