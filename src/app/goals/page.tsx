"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useDayFlow } from "@/context/dayflow-provider";
import { Badge, EmptyState, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { goalProgress } from "@/lib/analytics/score";
import { createId } from "@/lib/utils";
import { TASK_CATEGORIES, type GoalStatus, type Milestone } from "@/types";

export default function GoalsPage() {
  const { state, dispatch } = useDayFlow();
  const [tab, setTab] = useState<GoalStatus | "all">("active");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(TASK_CATEGORIES[0]);
  const [targetDate, setTargetDate] = useState("");
  const [milestones, setMilestones] = useState<string[]>([""]);
  const [error, setError] = useState("");

  const filtered = useMemo(
    () =>
      state.goals.filter((g) => (tab === "all" ? true : g.status === tab)),
    [state.goals, tab],
  );

  function save() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    const ms: Milestone[] = milestones
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => ({ id: createId("ms"), title: t, completed: false }));
    dispatch({
      type: "ADD_GOAL",
      goal: {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        targetDate: targetDate || undefined,
        status: "active",
        milestones: ms,
      },
    });
    setOpen(false);
    setTitle("");
    setDescription("");
    setMilestones([""]);
    setError("");
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

      <div className="mb-5 flex flex-wrap gap-1 rounded-xl bg-muted p-1 w-fit">
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
                <Link href={`/goals/${goal.id}`} className="df-card block p-5 hover:bg-muted/30">
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

      <Modal open={open} onClose={() => setOpen(false)} title="New goal" className="sm:max-w-xl">
        <div className="space-y-3">
          <div>
            <Label htmlFor="gtitle">Title</Label>
            <Input id="gtitle" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            <FieldError>{error}</FieldError>
          </div>
          <div>
            <Label htmlFor="gdesc">Description</Label>
            <Textarea id="gdesc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Category</Label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {TASK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="gdate">Target date</Label>
              <Input id="gdate" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Milestones</Label>
            <div className="space-y-2">
              {milestones.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={m}
                    onChange={(e) => {
                      const next = [...milestones];
                      next[i] = e.target.value;
                      setMilestones(next);
                    }}
                    placeholder={`Milestone ${i + 1}`}
                  />
                  {milestones.length > 1 && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setMilestones(milestones.filter((_, idx) => idx !== i))
                      }
                      aria-label="Remove milestone"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setMilestones([...milestones, ""])}
              >
                Add milestone
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
