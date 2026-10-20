import { z } from 'zod';

export const WorkTypeSchema = z.string().min(1, 'Arbeidets art er påkrevd');
export type WorkType = z.infer<typeof WorkTypeSchema>;

export const RegiSourceTypeSchema = z.enum(['misc', 'task']);
export type RegiSourceType = z.infer<typeof RegiSourceTypeSchema>;

export const WorkStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type WorkStatus = z.infer<typeof WorkStatusSchema>;

export type RegiRecordBase = {
  id: string;
  userId: string;
  title: string;
  description?: string;
  hours: number;
  date: Date;
  createdAt: Date;
  sourceType: RegiSourceType;
  imagePaths?: string[];
  // The room the work was done on, when there is one.
  roomNumber?: number;
};

export type RegiUserSummary = {
  userName: string;
  userEmail: string;
};

export const RegiLogSchema = z.object({
  userId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  date: z.date(),
  hours: z.number().positive(),
  type: WorkTypeSchema,
  status: WorkStatusSchema.default('pending'),
  createdAt: z.date(),
  reviewedBy: z.string().optional(),
  reviewerComment: z.string().optional(),
  imageUrl: z.url().optional(),
  imagePaths: z.array(z.string()).optional(),
  roomId: z.string().optional(),
});
export type RegiLog = z.infer<typeof RegiLogSchema>;

export type RegiLogWithId = RegiRecordBase & {
  workId?: string;
  // `date` is when the work happened; `createdAt` is when the row was registered.
  status: WorkStatus;
  type: WorkType;
  reviewerComment?: string;
};

export type PendingRegiApproval = RegiRecordBase &
  RegiUserSummary & {
    category: string;
  };

export type RegiLogWithUser = RegiRecordBase &
  RegiUserSummary & {
    category: string;
    status: WorkStatus;
    approvedByName?: string;
    approvalComment?: string | null;
  };
