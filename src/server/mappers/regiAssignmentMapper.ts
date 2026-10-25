import {
  PendingRegiApproval,
  RegiLogWithId,
  RegiLogWithUser,
  RegiSourceType,
  WorkStatus,
} from '../../shared/types/regi';

export type WorkItemTypeRelation =
  | { type: string | null }
  | Array<{ type: string | null }>
  | null
  | undefined;

export type WorkMiscRelation =
  | { image_paths?: string[] | null }
  | Array<{ image_paths?: string[] | null }>
  | null;

export type RegiWorkItemRelation =
  | {
      title?: string | null;
      description?: string | null;
      type?: string | null;
      work_categories?: { name?: string | null } | null;
      work_misc?: WorkMiscRelation;
      rooms?: { number?: number | null } | Array<{ number?: number | null }> | null;
    }
  | null
  | undefined;

export type RegiAssignmentRow = {
  id?: number | string;
  user_uuid?: string | null;
  work_id?: number | string | null;
  hours_used?: number | string | null;
  created_at?: Date | string | { seconds: number } | null;
  performed_at?: Date | string | { seconds: number } | null;
  approved_state?: number | null;
  approval_comment?: string | null;
  approved_by_uuid?: string | null;
  work_items?: RegiWorkItemRelation;
};

export type RegiUserLookup = {
  name: string;
  email: string;
};

const statusByApprovedState: Record<number, WorkStatus> = {
  0: 'pending',
  1: 'approved',
  2: 'rejected',
};

export function toDate(value: Date | string | { seconds: number } | null | undefined): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (
    value &&
    typeof value === 'object' &&
    'seconds' in value &&
    typeof value.seconds === 'number'
  ) {
    return new Date(value.seconds * 1000);
  }

  return new Date(0);
}

export function getWorkItemType(workItems: WorkItemTypeRelation): string | undefined {
  if (Array.isArray(workItems)) {
    return workItems[0]?.type ?? undefined;
  }

  return workItems?.type ?? undefined;
}

export function getImagePaths(workItems: RegiWorkItemRelation): string[] {
  const workMisc = Array.isArray(workItems?.work_misc)
    ? workItems?.work_misc[0]
    : workItems?.work_misc;
  return Array.from(new Set((workMisc?.image_paths ?? []).filter(Boolean)));
}

export function isCountableRegiAssignment(row: RegiAssignmentRow): boolean {
  const workType = row.work_items?.type;

  if (workType === 'misc') {
    return true;
  }

  if (workType === 'task') {
    return row.hours_used != null;
  }

  return false;
}

function getRoomNumber(workItems: RegiWorkItemRelation): number | undefined {
  const room = Array.isArray(workItems?.rooms) ? workItems?.rooms[0] : workItems?.rooms;
  return room?.number ?? undefined;
}

function getStatus(row: RegiAssignmentRow): WorkStatus {
  return statusByApprovedState[row.approved_state ?? 0] ?? 'pending';
}

function getSourceType(row: RegiAssignmentRow): RegiSourceType {
  return row.work_items?.type === 'task' ? 'task' : 'misc';
}

function getCategory(row: RegiAssignmentRow): string {
  return row.work_items?.work_categories?.name ?? 'Regi';
}

function getBaseProjection(row: RegiAssignmentRow) {
  return {
    id: String(row.id),
    userId: row.user_uuid ? String(row.user_uuid) : '',
    sourceType: getSourceType(row),
    title: row.work_items?.title ?? '',
    description: row.work_items?.description ?? undefined,
    hours: Number(row.hours_used ?? 0),
    date: toDate(row.performed_at ?? row.created_at),
    createdAt: toDate(row.created_at),
    imagePaths: getImagePaths(row.work_items),
    roomNumber: getRoomNumber(row.work_items),
  };
}

export function toRegiLogWithId(row: RegiAssignmentRow, userId: string): RegiLogWithId {
  const base = getBaseProjection(row);

  return {
    ...base,
    userId,
    workId: row.work_id ? String(row.work_id) : undefined,
    status: getStatus(row),
    type: row.work_items?.work_categories?.name ?? row.work_items?.type ?? 'misc',
    reviewerComment: row.approval_comment ?? undefined,
  };
}

export function toPendingRegiApproval(
  row: RegiAssignmentRow,
  user: RegiUserLookup | undefined
): PendingRegiApproval {
  return {
    ...getBaseProjection(row),
    userId: row.user_uuid ? String(row.user_uuid) : '',
    userName: user?.name ?? 'Ukjent',
    userEmail: user?.email ?? '',
    category: getCategory(row),
  };
}

export function toRegiLogWithUser(
  row: RegiAssignmentRow,
  owner: RegiUserLookup | undefined,
  approver: RegiUserLookup | undefined
): RegiLogWithUser {
  return {
    ...getBaseProjection(row),
    userName: owner?.name ?? 'Ukjent',
    userEmail: owner?.email ?? '',
    category: getCategory(row),
    status: getStatus(row),
    approvedByName: approver?.name,
    approvalComment: row.approval_comment ?? null,
  };
}
