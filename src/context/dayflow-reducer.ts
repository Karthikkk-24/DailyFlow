import type {
  AppState,
  FocusSession,
  Goal,
  Habit,
  Milestone,
  ScheduleBlock,
  Task,
  ThemeMode,
  UserProfile,
} from "@/types";
import { createId, nowIso, todayKey } from "@/lib/utils";
import { upsertTodaySnapshot, upsertSnapshotForDate, rebuildHistorySnapshots } from "@/lib/analytics/score";
import { MAX_HABITS } from "@/schemas/app-state.schema";
import { createSeededState, personalizeAfterOnboarding, habitsMissingFromDesired, syncDeepWorkBlocksForWorkingHours } from "@/lib/seed/demo-data";

export type DayFlowAction =
  | { type: "HYDRATE"; state: AppState }
  | { type: "COMPLETE_ONBOARDING"; profile: UserProfile }
  | { type: "SKIP_ONBOARDING" }
  | { type: "RESTART_ONBOARDING" }
  | { type: "UPDATE_PROFILE"; profile: Partial<UserProfile> }
  | { type: "SET_THEME"; theme: ThemeMode }
  | { type: "SET_FOCUS_TICK_SOUND"; enabled: boolean }
  | { type: "ADD_TASK"; task: Omit<Task, "id" | "createdAt" | "updatedAt" | "order"> & { order?: number } }
  | { type: "UPDATE_TASK"; id: string; patch: Partial<Task> }
  | { type: "DELETE_TASK"; id: string }
  | { type: "MOVE_TASK"; id: string; status: Task["status"]; order?: number }
  | { type: "REORDER_TASKS"; status: Task["status"]; orderedIds: string[] }
  | { type: "ADD_HABIT"; habit: Omit<Habit, "id" | "createdAt"> }
  | { type: "UPDATE_HABIT"; id: string; patch: Partial<Habit> }
  | { type: "DELETE_HABIT"; id: string }
  | { type: "TOGGLE_HABIT_DAY"; habitId: string; date: string }
  | { type: "ADD_GOAL"; goal: Omit<Goal, "id" | "createdAt"> }
  | { type: "UPDATE_GOAL"; id: string; patch: Partial<Goal> }
  | { type: "DELETE_GOAL"; id: string }
  | { type: "TOGGLE_MILESTONE"; goalId: string; milestoneId: string }
  | { type: "ADD_BLOCK"; block: Omit<ScheduleBlock, "id"> }
  | { type: "UPDATE_BLOCK"; id: string; patch: Partial<ScheduleBlock> }
  | { type: "DELETE_BLOCK"; id: string }
  | { type: "COMPLETE_FOCUS"; session: Omit<FocusSession, "id"> }
  | { type: "RESET_DEMO"; keepName?: boolean }
  | { type: "ROLLOVER_STALE_TODAY"; today: string }
  | { type: "REPLACE_STATE"; state: AppState };

function touch(state: AppState): AppState {
  return {
    ...state,
    meta: { ...state.meta, updatedAt: nowIso() },
  };
}

function withSnapshot(state: AppState): AppState {
  return upsertTodaySnapshot(touch(state));
}

export function dayFlowReducer(
  state: AppState,
  action: DayFlowAction,
): AppState {
  switch (action.type) {
    case "HYDRATE":
    case "REPLACE_STATE":
      // Rebuild recent history from entities so Analytics matches imported/loaded data.
      return rebuildHistorySnapshots(action.state, 30);

    case "COMPLETE_ONBOARDING":
      return withSnapshot(personalizeAfterOnboarding(state, action.profile));

    case "SKIP_ONBOARDING":
      return withSnapshot({
        ...state,
        meta: { ...state.meta, onboardingCompleted: true, updatedAt: nowIso() },
      });

    case "RESTART_ONBOARDING":
      return touch({
        ...state,
        meta: { ...state.meta, onboardingCompleted: false },
      });

    case "UPDATE_PROFILE": {
      const profile = { ...state.profile, ...action.profile };
      const missingHabits =
        action.profile.desiredHabits !== undefined
          ? habitsMissingFromDesired(state.habits, profile.desiredHabits)
          : [];
      const room = Math.max(0, MAX_HABITS - state.habits.length);
      const newHabits = missingHabits.slice(0, room);
      const hoursChanged =
        action.profile.workingHours !== undefined &&
        (action.profile.workingHours.start !== state.profile.workingHours.start ||
          action.profile.workingHours.end !== state.profile.workingHours.end);
      const scheduleBlocks = hoursChanged
        ? syncDeepWorkBlocksForWorkingHours(state.scheduleBlocks, profile)
        : state.scheduleBlocks;
      return touch({
        ...state,
        profile,
        habits: newHabits.length ? [...state.habits, ...newHabits] : state.habits,
        scheduleBlocks,
      });
    }

    case "SET_THEME":
      return touch({
        ...state,
        meta: { ...state.meta, theme: action.theme },
      });

    case "SET_FOCUS_TICK_SOUND":
      return touch({
        ...state,
        meta: { ...state.meta, focusTickSound: action.enabled },
      });

    case "ROLLOVER_STALE_TODAY": {
      let changed = false;
      const tasks = state.tasks.map((t) => {
        const staleSinceYesterday =
          todayKey(new Date(t.updatedAt)) < action.today;

        if (t.status === "in_progress") {
          if (!staleSinceYesterday) return t;
          changed = true;
          return {
            ...t,
            status: "backlog" as const,
            updatedAt: nowIso(),
          };
        }

        if (t.status !== "today") return t;
        const dueBeforeToday = !!t.dueDate && t.dueDate < action.today;
        if (!dueBeforeToday && !staleSinceYesterday) return t;
        changed = true;
        return {
          ...t,
          status: "backlog" as const,
          updatedAt: nowIso(),
        };
      });
      return changed ? withSnapshot({ ...state, tasks }) : state;
    }

    case "ADD_TASK": {
      const now = nowIso();
      const sameStatus = state.tasks.filter((t) => t.status === action.task.status);
      const task: Task = {
        ...action.task,
        id: createId("task"),
        createdAt: now,
        updatedAt: now,
        order: action.task.order ?? sameStatus.length,
      };
      if (task.status === "done") {
        task.completedAt = task.completedAt ?? now;
        task.previousStatus = task.previousStatus ?? "backlog";
      } else {
        task.completedAt = undefined;
        task.previousStatus = undefined;
      }
      return withSnapshot({ ...state, tasks: [...state.tasks, task] });
    }

    case "UPDATE_TASK": {
      const tasks = state.tasks.map((t) => {
        if (t.id !== action.id) return t;
        const next: Task = { ...t, ...action.patch, updatedAt: nowIso() };
        if (next.status !== "done") {
          next.completedAt = undefined;
          if (action.patch.status && action.patch.status !== "done") {
            next.previousStatus = undefined;
          }
        } else {
          if (t.status !== "done") {
            next.previousStatus = t.status;
          }
          if (!next.completedAt) {
            next.completedAt = nowIso();
          }
        }
        return next;
      });
      return withSnapshot({ ...state, tasks });
    }

    case "DELETE_TASK":
      return withSnapshot({
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.id),
        focusSessions: state.focusSessions.map((s) =>
          s.linkedTaskId === action.id
            ? { ...s, linkedTaskId: undefined }
            : s,
        ),
      });

    case "MOVE_TASK": {
      const tasks = state.tasks.map((t) => {
        if (t.id !== action.id) return t;
        const patch: Partial<Task> = {
          status: action.status,
          updatedAt: nowIso(),
          order: action.order ?? t.order,
        };
        if (action.status === "done") {
          patch.completedAt = nowIso();
          if (t.status !== "done") {
            patch.previousStatus = t.status;
          }
        } else if (t.status === "done") {
          patch.completedAt = undefined;
          patch.previousStatus = undefined;
        }
        return { ...t, ...patch };
      });
      return withSnapshot({ ...state, tasks });
    }

    case "REORDER_TASKS": {
      const orderMap = new Map(action.orderedIds.map((id, i) => [id, i]));
      const tasks = state.tasks.map((t) => {
        if (t.status !== action.status) return t;
        const order = orderMap.get(t.id);
        return order === undefined ? t : { ...t, order, updatedAt: nowIso() };
      });
      return touch({ ...state, tasks });
    }

    case "ADD_HABIT": {
      if (state.habits.length >= MAX_HABITS) return state;
      const habit: Habit = {
        ...action.habit,
        id: createId("hab"),
        createdAt: nowIso(),
      };
      return withSnapshot({ ...state, habits: [...state.habits, habit] });
    }

    case "UPDATE_HABIT":
      return withSnapshot({
        ...state,
        habits: state.habits.map((h) =>
          h.id === action.id ? { ...h, ...action.patch } : h,
        ),
      });

    case "DELETE_HABIT":
      return withSnapshot({
        ...state,
        habits: state.habits.filter((h) => h.id !== action.id),
        habitLogs: state.habitLogs.filter((l) => l.habitId !== action.id),
      });

    case "TOGGLE_HABIT_DAY": {
      const existing = state.habitLogs.find(
        (l) => l.habitId === action.habitId && l.date === action.date,
      );
      let habitLogs;
      if (existing) {
        habitLogs = state.habitLogs.map((l) =>
          l.habitId === action.habitId && l.date === action.date
            ? { ...l, completed: !l.completed }
            : l,
        );
      } else {
        habitLogs = [
          ...state.habitLogs,
          { habitId: action.habitId, date: action.date, completed: true },
        ];
      }
      const next = touch({ ...state, habitLogs });
      // Refresh the toggled day's row (today or historical) so Analytics stays accurate.
      let withDate = upsertSnapshotForDate(next, action.date);
      if (action.date !== todayKey()) {
        withDate = upsertTodaySnapshot(withDate);
      }
      return withDate;
    }

    case "ADD_GOAL": {
      const goal: Goal = {
        ...action.goal,
        id: createId("goal"),
        createdAt: nowIso(),
      };
      return withSnapshot({ ...state, goals: [...state.goals, goal] });
    }

    case "UPDATE_GOAL": {
      const goals = state.goals.map((g) => {
        if (g.id !== action.id) return g;
        const next = { ...g, ...action.patch };
        const allDone =
          next.milestones.length > 0 &&
          next.milestones.every((m) => m.completed);
        // Keep status aligned with milestone completion whenever either changes.
        if (action.patch.milestones || action.patch.status !== undefined) {
          if (allDone && (next.status === "active" || next.status === "paused")) {
            next.reopenStatus = next.status;
            next.status = "completed";
          } else if (
            next.milestones.some((m) => !m.completed) &&
            next.status === "completed"
          ) {
            // Cannot mark completed while milestones remain open.
            next.status = next.reopenStatus ?? "active";
            next.reopenStatus = undefined;
          }
        }
        return next;
      });
      return withSnapshot({ ...state, goals });
    }

    case "DELETE_GOAL":
      return withSnapshot({
        ...state,
        goals: state.goals.filter((g) => g.id !== action.id),
        focusSessions: state.focusSessions.map((s) =>
          s.linkedGoalId === action.id
            ? { ...s, linkedGoalId: undefined }
            : s,
        ),
      });

    case "TOGGLE_MILESTONE": {
      const goals = state.goals.map((g) => {
        if (g.id !== action.goalId) return g;
        const milestones: Milestone[] = g.milestones.map((m) => {
          if (m.id !== action.milestoneId) return m;
          const completed = !m.completed;
          return {
            ...m,
            completed,
            completedAt: completed ? nowIso() : undefined,
          };
        });
        const allDone =
          milestones.length > 0 && milestones.every((m) => m.completed);
        if (allDone && (g.status === "active" || g.status === "paused")) {
          return {
            ...g,
            milestones,
            status: "completed" as const,
            reopenStatus: g.status,
          };
        }
        if (!allDone && g.status === "completed") {
          return {
            ...g,
            milestones,
            status: g.reopenStatus ?? "active",
            reopenStatus: undefined,
          };
        }
        return { ...g, milestones };
      });
      return withSnapshot({ ...state, goals });
    }

    case "ADD_BLOCK": {
      const block: ScheduleBlock = {
        ...action.block,
        id: createId("blk"),
      };
      return withSnapshot({
        ...state,
        scheduleBlocks: [...state.scheduleBlocks, block],
      });
    }

    case "UPDATE_BLOCK":
      return withSnapshot({
        ...state,
        scheduleBlocks: state.scheduleBlocks.map((b) =>
          b.id === action.id ? { ...b, ...action.patch } : b,
        ),
      });

    case "DELETE_BLOCK":
      return withSnapshot({
        ...state,
        scheduleBlocks: state.scheduleBlocks.filter((b) => b.id !== action.id),
      });

    case "COMPLETE_FOCUS": {
      const session: FocusSession = {
        ...action.session,
        id: createId("focus"),
      };
      return withSnapshot({
        ...state,
        focusSessions: [...state.focusSessions, session],
      });
    }

    case "RESET_DEMO": {
      const seeded = createSeededState(
        action.keepName
          ? { name: state.profile.name }
          : undefined,
      );
      return {
        ...seeded,
        meta: {
          ...seeded.meta,
          onboardingCompleted: true,
          theme: state.meta.theme,
          focusTickSound: state.meta.focusTickSound,
        },
      };
    }

    default:
      return state;
  }
}
