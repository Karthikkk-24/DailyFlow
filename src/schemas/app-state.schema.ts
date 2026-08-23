import { z } from "zod";

export const workingHoursSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

export const userProfileSchema = z.object({
  name: z.string().min(1).max(80),
  primaryGoal: z.string().max(500),
  workingHours: workingHoursSchema,
  energyPattern: z.enum(["morning", "afternoon", "evening", "mixed"]),
  desiredHabits: z.array(z.string().max(80)).max(20),
});

export const appMetaSchema = z.object({
  createdAt: z.string(),
  updatedAt: z.string(),
  onboardingCompleted: z.boolean(),
  theme: z.enum(["light", "dark", "system"]),
  focusTickSound: z.boolean().default(false),
});

export const taskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(["backlog", "today", "in_progress", "done"]),
  priority: z.enum(["low", "medium", "high"]),
  category: z.string().min(1).max(40),
  dueDate: z.string().optional(),
  dueTime: z.string().optional(),
  completedAt: z.string().optional(),
  previousStatus: z.enum(["backlog", "today", "in_progress"]).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  order: z.number(),
});

export const habitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  icon: z.string().min(1).max(40),
  color: z.string().optional(),
  frequency: z.enum(["daily", "weekly"]),
  targetDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  createdAt: z.string(),
});

export const habitLogSchema = z.object({
  habitId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  completed: z.boolean(),
});

export const milestoneSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  completed: z.boolean(),
  completedAt: z.string().optional(),
});

export const goalSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().min(1).max(40),
  targetDate: z.string().optional(),
  status: z.enum(["active", "completed", "paused"]),
  reopenStatus: z.enum(["active", "paused"]).optional(),
  milestones: z.array(milestoneSchema).max(50),
  createdAt: z.string(),
});

export const scheduleBlockSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  category: z.enum([
    "deep_work",
    "meetings",
    "exercise",
    "personal",
    "study",
  ]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().max(1000).optional(),
});

export const focusSessionSchema = z.object({
  id: z.string().min(1),
  durationMinutes: z.number().positive().max(480),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  linkedTaskId: z.string().optional(),
  linkedGoalId: z.string().optional(),
});

export const analyticsSnapshotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tasksCompleted: z.number().int().min(0),
  habitsCompleted: z.number().int().min(0),
  habitsTotal: z.number().int().min(0),
  focusMinutes: z.number().min(0),
  scheduleBlocksCompleted: z.number().int().min(0),
  todayScore: z.number().min(0).max(100),
});

export const appStateSchema = z.object({
  version: z.literal(1),
  meta: appMetaSchema,
  profile: userProfileSchema,
  tasks: z.array(taskSchema).max(5000),
  habits: z.array(habitSchema).max(200),
  habitLogs: z.array(habitLogSchema).max(50000),
  goals: z.array(goalSchema).max(500),
  scheduleBlocks: z.array(scheduleBlockSchema).max(5000),
  focusSessions: z.array(focusSessionSchema).max(5000),
  analyticsSnapshots: z.array(analyticsSnapshotSchema).max(400),
});

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
