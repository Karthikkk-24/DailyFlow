"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Search, Trash2 } from "lucide-react";
import { useDayFlow } from "@/context/dayflow-provider";
import { Badge, EmptyState, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { cn, todayKey } from "@/lib/utils";
import {
  TASK_CATEGORIES,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/types";

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "today", label: "Today" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Done" },
];

function SortableTask({
  task,
  onOpen,
}: {
  task: Task;
  onOpen: (t: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { status: task.status } });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "df-card flex gap-2 p-3",
        isDragging && "opacity-70 ring-2 ring-primary",
      )}
    >
      <button
        type="button"
        className="mt-0.5 cursor-grab text-muted-foreground active:cursor-grabbing"
        aria-label="Drag task"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => onOpen(task)}
      >
        <p className="truncate font-medium">{task.title}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          <Badge tone={task.priority}>{task.priority}</Badge>
          <Badge>{task.category}</Badge>
        </div>
      </button>
    </div>
  );
}

function Column({
  status,
  label,
  tasks,
  onOpen,
}: {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  onOpen: (t: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[280px] flex-col rounded-2xl border border-border bg-muted/40 p-3",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2">
          {tasks.map((t) => (
            <SortableTask key={t.id} task={t} onOpen={onOpen} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

const emptyForm = {
  title: "",
  description: "",
  status: "today" as TaskStatus,
  priority: "medium" as TaskPriority,
  category: TASK_CATEGORIES[0] as string,
  dueDate: "",
  dueTime: "",
};

export default function TasksPage() {
  const { state, dispatch } = useDayFlow();
  const [view, setView] = useState<"list" | "board">("board");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [priority, setPriority] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [due, setDue] = useState<string>("all");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(id);
  }, [query]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const today = todayKey();
    return state.tasks
      .filter((t) => {
        if (q && !t.title.toLowerCase().includes(q) && !(t.description ?? "").toLowerCase().includes(q))
          return false;
        if (priority !== "all" && t.priority !== priority) return false;
        if (category !== "all" && t.category !== category) return false;
        if (status !== "all" && t.status !== status) return false;
        if (due === "today" && t.dueDate !== today) return false;
        if (due === "overdue" && (!t.dueDate || t.dueDate >= today || t.status === "done"))
          return false;
        if (due === "none" && t.dueDate) return false;
        if (due === "range") {
          if (!t.dueDate) return false;
          if (dueFrom && t.dueDate < dueFrom) return false;
          if (dueTo && t.dueDate > dueTo) return false;
        }
        return true;
      })
      .sort((a, b) => a.order - b.order);
  }, [state.tasks, debouncedQuery, priority, category, status, due, dueFrom, dueTo]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, dueDate: todayKey() });
    setError("");
    setModalOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      status: task.status,
      priority: task.priority,
      category: task.category,
      dueDate: task.dueDate ?? "",
      dueTime: task.dueTime ?? "",
    });
    setError("");
    setModalOpen(true);
  }

  function save() {
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (form.dueTime && !form.dueDate) {
      setError("Due time requires a due date.");
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      status: form.status,
      priority: form.priority,
      category: form.category,
      dueDate: form.dueDate || undefined,
      dueTime: form.dueTime || undefined,
    };
    if (editing) {
      dispatch({ type: "UPDATE_TASK", id: editing.id, patch: payload });
      if (editing.status !== form.status) {
        dispatch({ type: "MOVE_TASK", id: editing.id, status: form.status });
      }
    } else {
      dispatch({ type: "ADD_TASK", task: payload });
    }
    setModalOpen(false);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const task = state.tasks.find((t) => t.id === active.id);
    if (!task) return;

    const overId = String(over.id);
    const overIsColumn = COLUMNS.some((c) => c.id === overId);
    const overTask = state.tasks.find((t) => t.id === overId);
    const nextStatus = (overIsColumn ? overId : overTask?.status) as TaskStatus;
    if (!nextStatus) return;

    if (task.status !== nextStatus) {
      const columnTasks = state.tasks
        .filter((t) => t.status === nextStatus)
        .sort((a, b) => a.order - b.order);
      dispatch({
        type: "MOVE_TASK",
        id: task.id,
        status: nextStatus,
        order: columnTasks.length,
      });
      return;
    }

    if (overTask && task.id !== overTask.id) {
      const fullColumn = state.tasks
        .filter((t) => t.status === task.status)
        .sort((a, b) => a.order - b.order);
      const visible = filtered
        .filter((t) => t.status === task.status)
        .sort((a, b) => a.order - b.order);
      const oldIndex = visible.findIndex((t) => t.id === task.id);
      const newIndex = visible.findIndex((t) => t.id === overTask.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const reorderedVisible = arrayMove(visible, oldIndex, newIndex).map(
        (t) => t.id,
      );
      // Merge filtered reorder into the full column so hidden tasks keep stable slots.
      const visibleSet = new Set(visible.map((t) => t.id));
      let vi = 0;
      const orderedIds = fullColumn.map((t) =>
        visibleSet.has(t.id) ? reorderedVisible[vi++]! : t.id,
      );
      dispatch({
        type: "REORDER_TASKS",
        status: task.status,
        orderedIds,
      });
    }
  }

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="List and board views with filters and drag-and-drop."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New task
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search tasks…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search tasks"
          />
        </div>
        <div className="flex rounded-xl bg-muted p-1">
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm",
              view === "list" && "bg-card shadow-sm",
            )}
            onClick={() => setView("list")}
          >
            List
          </button>
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm",
              view === "board" && "bg-card shadow-sm",
            )}
            onClick={() => setView("board")}
          >
            Board
          </button>
        </div>
      </div>

      <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Filter priority">
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter category">
          <option value="all">All categories</option>
          {TASK_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status">
          <option value="all">All statuses</option>
          {COLUMNS.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </Select>
        <Select value={due} onChange={(e) => setDue(e.target.value)} aria-label="Filter due date">
          <option value="all">Any due date</option>
          <option value="today">Due today</option>
          <option value="overdue">Overdue</option>
          <option value="range">Date range</option>
          <option value="none">No due date</option>
        </Select>
      </div>

      {due === "range" && (
        <div className="mb-5 grid gap-2 sm:grid-cols-2">
          <div>
            <Label htmlFor="due-from">Due from</Label>
            <Input
              id="due-from"
              type="date"
              value={dueFrom}
              onChange={(e) => setDueFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="due-to">Due to</Label>
            <Input
              id="due-to"
              type="date"
              value={dueTo}
              onChange={(e) => setDueTo(e.target.value)}
            />
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title="No tasks match"
          description="Try clearing filters or create a new task."
          action={<Button onClick={openCreate}>New task</Button>}
        />
      ) : view === "list" ? (
        <ul className="space-y-2">
          {filtered.map((task) => (
            <li key={task.id} className="df-card flex items-center gap-3 p-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => openEdit(task)}
              >
                <p className="font-medium">{task.title}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge tone={task.priority}>{task.priority}</Badge>
                  <Badge>{task.status.replace("_", " ")}</Badge>
                  <Badge>{task.category}</Badge>
                  {task.dueDate && (
                    <span className="text-xs text-muted-foreground">
                      {task.dueDate}
                      {task.dueTime ? ` · ${task.dueTime}` : ""}
                    </span>
                  )}
                </div>
              </button>
              <Select
                className="w-36"
                value={task.status}
                aria-label={`Move ${task.title}`}
                onChange={(e) =>
                  dispatch({
                    type: "MOVE_TASK",
                    id: task.id,
                    status: e.target.value as TaskStatus,
                  })
                }
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </Select>
            </li>
          ))}
        </ul>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={onDragEnd}
        >
          <div className="grid gap-3 lg:grid-cols-4">
            {COLUMNS.map((col) => (
              <Column
                key={col.id}
                status={col.id}
                label={col.label}
                tasks={filtered
                  .filter((t) => t.status === col.id)
                  .sort((a, b) => a.order - b.order)}
                onOpen={openEdit}
              />
            ))}
          </div>
        </DndContext>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit task" : "New task"}
        className="sm:max-w-xl"
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={200}
            />
            <FieldError>{error}</FieldError>
          </div>
          <div>
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={2000}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as TaskStatus })
                }
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: e.target.value as TaskPriority })
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {TASK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="dueDate">Due date</Label>
              <Input
                id="dueDate"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="dueTime">Due time</Label>
              <Input
                id="dueTime"
                type="time"
                value={form.dueTime}
                onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            {editing ? (
              <Button
                variant="danger"
                onClick={() => {
                  setDeleteId(editing.id);
                  setModalOpen(false);
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={save}>Save</Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete task?"
        description="This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (deleteId) dispatch({ type: "DELETE_TASK", id: deleteId });
        }}
      />
    </div>
  );
}
