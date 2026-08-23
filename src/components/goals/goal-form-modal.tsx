"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { createId } from "@/lib/utils";
import {
  TASK_CATEGORIES,
  type Goal,
  type Milestone,
} from "@/types";

export type GoalFormValues = {
  title: string;
  description?: string;
  category: string;
  targetDate?: string;
  milestones: Milestone[];
};

type DraftMilestone = {
  key: string;
  id?: string;
  title: string;
  completed: boolean;
  completedAt?: string;
};

function draftsFromGoal(goal?: Goal | null): DraftMilestone[] {
  if (!goal || goal.milestones.length === 0) {
    return [{ key: createId("draft"), title: "", completed: false }];
  }
  return goal.milestones.map((m) => ({
    key: m.id,
    id: m.id,
    title: m.title,
    completed: m.completed,
    completedAt: m.completedAt,
  }));
}

function GoalFormFields({
  goal,
  onClose,
  onSave,
}: {
  goal?: Goal | null;
  onClose: () => void;
  onSave: (values: GoalFormValues) => void;
}) {
  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [category, setCategory] = useState(goal?.category ?? TASK_CATEGORIES[0]);
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [drafts, setDrafts] = useState<DraftMilestone[]>(() => draftsFromGoal(goal));
  const [error, setError] = useState("");

  function save() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    const milestones: Milestone[] = drafts
      .map((d) => ({ ...d, title: d.title.trim() }))
      .filter((d) => d.title)
      .map((d) => ({
        id: d.id ?? createId("ms"),
        title: d.title,
        completed: d.completed,
        completedAt: d.completed ? d.completedAt : undefined,
      }));

    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      targetDate: targetDate || undefined,
      milestones,
    });
    onClose();
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="gtitle">Title</Label>
        <Input
          id="gtitle"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
        <FieldError>{error}</FieldError>
      </div>
      <div>
        <Label htmlFor="gdesc">Description</Label>
        <Textarea
          id="gdesc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Category</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {TASK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="gdate">Target date</Label>
          <Input
            id="gdate"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label>Milestones</Label>
        <div className="space-y-2">
          {drafts.map((m, i) => (
            <div key={m.key} className="flex gap-2">
              <Input
                value={m.title}
                onChange={(e) => {
                  const next = [...drafts];
                  next[i] = { ...m, title: e.target.value };
                  setDrafts(next);
                }}
                placeholder={`Milestone ${i + 1}`}
                maxLength={200}
              />
              {drafts.length > 1 && (
                <Button
                  variant="ghost"
                  onClick={() => setDrafts(drafts.filter((_, idx) => idx !== i))}
                  aria-label="Remove milestone"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {drafts.length < 50 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setDrafts([
                  ...drafts,
                  { key: createId("draft"), title: "", completed: false },
                ])
              }
            >
              Add milestone
            </Button>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save}>{goal ? "Save" : "Create"}</Button>
      </div>
    </div>
  );
}

export function GoalFormModal({
  open,
  onClose,
  goal,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  goal?: Goal | null;
  onSave: (values: GoalFormValues) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={goal ? "Edit goal" : "New goal"}
      className="sm:max-w-xl"
    >
      {open && (
        <GoalFormFields
          key={goal?.id ?? "new"}
          goal={goal}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    </Modal>
  );
}
