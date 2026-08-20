export type ThemeMode = "light" | "dark" | "system";
export type EnergyPattern = "morning" | "afternoon" | "evening" | "mixed";
export type TaskStatus = "backlog" | "today" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type GoalStatus = "active" | "completed" | "paused";
export type HabitFrequency = "daily" | "weekly";
export type BlockCategory =
  | "deep_work"
  | "meetings"
  | "exercise"
  | "personal"
  | "study";

export interface WorkingHours {
  start: string;
  end: string;
}

export interface UserProfile {
  name: string;
  primaryGoal: string;
  workingHours: WorkingHours;
  energyPattern: EnergyPattern;
  desiredHabits: string[];
}

export interface AppMeta {
  createdAt: string;
  updatedAt: string;
  onboardingCompleted: boolean;
  theme: ThemeMode;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: string;
  dueDate?: string;
  dueTime?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  order: number;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color?: string;
  frequency: HabitFrequency;
  targetDays: number[];
  createdAt: string;
}

export interface HabitLog {
  habitId: string;
  date: string;
  completed: boolean;
}

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  category: string;
  targetDate?: string;
  status: GoalStatus;
  milestones: Milestone[];
  createdAt: string;
}

export interface ScheduleBlock {
  id: string;
  title: string;
  category: BlockCategory;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

export interface FocusSession {
  id: string;
  durationMinutes: number;
  startedAt: string;
  completedAt?: string;
  linkedTaskId?: string;
  linkedGoalId?: string;
}

export interface AnalyticsSnapshot {
  date: string;
  tasksCompleted: number;
  habitsCompleted: number;
  habitsTotal: number;
  focusMinutes: number;
  scheduleBlocksCompleted: number;
  todayScore: number;
}

export interface AppState {
  version: 1;
  meta: AppMeta;
  profile: UserProfile;
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  goals: Goal[];
  scheduleBlocks: ScheduleBlock[];
  focusSessions: FocusSession[];
  analyticsSnapshots: AnalyticsSnapshot[];
}

export const TASK_CATEGORIES = [
  "Work",
  "Personal",
  "Health",
  "Learning",
  "Errands",
] as const;

export const BLOCK_CATEGORIES: {
  value: BlockCategory;
  label: string;
}[] = [
  { value: "deep_work", label: "Deep Work" },
  { value: "meetings", label: "Meetings" },
  { value: "exercise", label: "Exercise" },
  { value: "personal", label: "Personal" },
  { value: "study", label: "Study" },
];

export const HABIT_ICONS = [
  "Sunrise",
  "BookOpen",
  "Dumbbell",
  "Droplets",
  "Brain",
  "Heart",
  "Leaf",
  "Moon",
  "Coffee",
  "Pencil",
  "Music",
  "Bike",
] as const;

export const HABIT_COLORS = [
  "#0D9488",
  "#2563EB",
  "#7C3AED",
  "#DB2777",
  "#EA580C",
  "#CA8A04",
  "#16A34A",
  "#64748B",
] as const;
