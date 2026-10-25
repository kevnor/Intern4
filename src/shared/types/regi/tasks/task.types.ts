import { z } from 'zod';

export const TaskAssignmentStatusSchema = z.enum(['joined', 'submitted', 'approved', 'rejected']);

export const TaskParticipantSchema = z.object({
  assignmentId: z.string(),
  userId: z.string().uuid(),
  status: TaskAssignmentStatusSchema,
  joinedAt: z.string(),
  hoursUsed: z.number().nullable().optional(),
  approvalComment: z.string().nullable().optional(),
  approvedByUuid: z.string().uuid().nullable().optional(),
});

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Tittel er påkrevd'),
  category: z.string().min(1, 'Kategori er påkrevd'),
  description: z.string().optional(),
  contactPersonId: z.string().uuid().optional(),
  deadline: z.string().nullable().optional(),
  hourEstimate: z.number().positive().nullable(),
  maxParticipants: z.number().int().positive(),
  participants: z.array(TaskParticipantSchema).default([]),
  createdAt: z.string(),
  isArchived: z.boolean().default(false),
});

export const TaskFormDataSchema = z.object({
  title: z.string(),
  category: z.string(),
  description: z.string().default(''),
  contactPersonId: z.string().default(''),
  deadline: z.string().default(''),
  hourEstimate: z.string().default(''),
  maxParticipants: z.string().default('1'),
});

export const TaskCreationDataSchema = z.object({
  title: z.string().min(1, 'Tittel er påkrevd'),
  category: z.string().min(1, 'Kategori er påkrevd'),
  description: z.string().optional(),
  contactPersonId: z.string().uuid().optional(),
  deadline: z.date().optional(),
  hourEstimate: z.number().positive(),
  maxParticipants: z.number().int().positive(),
  roomId: z.string().uuid().optional(),
});

export const TaskUpdateSchema = TaskCreationDataSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

export const TaskFilterSchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
});

export const TaskWithParticipantsSchema = TaskSchema.extend({
  participantNames: z.record(z.string(), z.string()).optional(),
});

export type TaskAssignmentStatus = z.infer<typeof TaskAssignmentStatusSchema>;
export type TaskParticipant = z.infer<typeof TaskParticipantSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type TaskFormData = z.infer<typeof TaskFormDataSchema>;
export type TaskCreationData = z.infer<typeof TaskCreationDataSchema>;
export type TaskUpdate = z.infer<typeof TaskUpdateSchema>;
export type TaskFilter = z.infer<typeof TaskFilterSchema>;
export type TaskWithParticipants = z.infer<typeof TaskWithParticipantsSchema>;

export const validateTask = (data: unknown): Task => {
  return TaskSchema.parse(data);
};

export const validateTaskFormData = (data: unknown): TaskFormData => {
  return TaskFormDataSchema.parse(data);
};

export const validateTaskCreationData = (data: unknown): TaskCreationData => {
  return TaskCreationDataSchema.parse(data);
};

export const validateTaskUpdate = (data: unknown): TaskUpdate => {
  return TaskUpdateSchema.parse(data);
};

export const safeParseTask = (data: unknown) => {
  return TaskSchema.safeParse(data);
};

export const safeParseTaskFormData = (data: unknown) => {
  return TaskFormDataSchema.safeParse(data);
};

export const safeParseTaskCreationData = (data: unknown) => {
  return TaskCreationDataSchema.safeParse(data);
};
