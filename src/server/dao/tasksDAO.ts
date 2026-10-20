import { supabase } from '../supabaseClient';
import { formatDateColumnValue } from '../../shared/utils/date';
import {
  canLeaveTaskAssignment,
  canSubmitTaskAssignment,
  Task,
  TaskAssignmentStatus,
  TaskCreationData,
  TaskParticipant,
} from '../../shared/types/regi/tasks';

type SupabaseJoin<T> = T | T[] | null | undefined;

type TaskParticipantRow = {
  id: number | string;
  user_uuid: string;
  approved_state?: number | null;
  hours_used?: number | null;
  created_at?: string | null;
  approval_comment?: string | null;
  approved_by_uuid?: string | null;
};

type TaskRow = {
  id: number | string;
  created_at?: string | null;
  deadline?: string | null;
  time_estimate?: number | string | null;
  contact_person_uuid?: string | null;
  max_participants?: number | string | null;
  work_items?: SupabaseJoin<{
    title?: string | null;
    description?: string | null;
    work_categories?: SupabaseJoin<{ name?: string | null }>;
    participants?: TaskParticipantRow[] | null;
  }>;
};

type TaskItemPatch = {
  title?: string;
  description?: string;
  work_category_id?: number | string;
};

type TaskPatch = {
  deadline?: Date | string | null;
  time_estimate?: number | null;
  contact_person_uuid?: string | null;
  max_participants?: number;
};

type AssignmentWorkIdRow = {
  work_id?: number | null;
};

function getJoinedValue<T>(value: SupabaseJoin<T>): T | undefined {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

export const getTaskAssignmentStatus = (row: {
  approved_state?: number | null;
  hours_used?: number | null;
}): TaskAssignmentStatus => {
  if (row.approved_state === 1) return 'approved';
  if (row.approved_state === 2) return 'rejected';
  if (row.hours_used != null) return 'submitted';
  return 'joined';
};

function toTaskParticipant(row: TaskParticipantRow): TaskParticipant {
  return {
    assignmentId: String(row.id),
    userId: String(row.user_uuid),
    status: getTaskAssignmentStatus(row),
    joinedAt: row.created_at ?? '',
    hoursUsed: row.hours_used != null ? Number(row.hours_used) : null,
    approvalComment: row.approval_comment ?? null,
    approvedByUuid: row.approved_by_uuid ? String(row.approved_by_uuid) : null,
  };
}

function toAppTask(row: TaskRow): Task {
  const workItem = getJoinedValue(row.work_items);
  const workCategory = getJoinedValue(workItem?.work_categories);

  return {
    id: String(row.id),
    title: workItem?.title ?? '',
    description: workItem?.description ?? '',
    category: workCategory?.name ?? '',
    contactPersonId: row.contact_person_uuid ? String(row.contact_person_uuid) : undefined,
    deadline: row.deadline ?? null,
    hourEstimate: row.time_estimate != null ? Number(row.time_estimate) : null,
    maxParticipants: Math.max(Number(row.max_participants ?? 1), 1),
    participants: (workItem?.participants ?? []).map(toTaskParticipant),
    createdAt: row.created_at ?? '',
    isArchived: false,
  };
}

async function getTaskOrThrow(taskId: string): Promise<Task> {
  const task = await getTask(taskId);
  if (!task) {
    throw new Error('Oppgaven ble ikke funnet');
  }
  return task;
}

async function getAssignmentRow(taskId: string, userId: string) {
  const { data, error } = await supabase
    .from('work_assignments')
    .select('id, user_uuid, approved_state, hours_used')
    .eq('work_id', Number(taskId))
    .eq('user_uuid', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not get assignment: ${error.message}`);
  }

  return data;
}

export async function addTask(data: TaskCreationData): Promise<string> {
  const { data: cat, error: e1 } = await supabase
    .from('work_categories')
    .select('id')
    .eq('name', data.category)
    .maybeSingle();
  if (e1) throw new Error(`Could not add task: ${e1.message}`);
  if (!cat) throw new Error(`Category '${data.category}' not found`);

  const { data: item, error: e2 } = await supabase
    .from('work_items')
    .insert({
      title: data.title,
      description: data.description ?? null,
      type: 'task',
      work_category_id: cat.id,
    })
    .select('id')
    .single();
  if (e2) throw new Error(`Could not add task: ${e2.message}`);

  const { error: e3 } = await supabase.from('work_tasks').insert({
    id: item.id,
    deadline: data.deadline ? formatDateColumnValue(data.deadline) : null,
    time_estimate: data.hourEstimate,
    contact_person_uuid: data.contactPersonId ?? null,
    max_participants: data.maxParticipants,
  });
  if (e3) throw new Error(`Could not add task: ${e3.message}`);

  return String(item.id);
}

export async function getTask(taskId: string): Promise<Task | undefined> {
  const { data, error } = await supabase
    .from('work_tasks')
    .select(
      `
      id,
      created_at,
      deadline,
      time_estimate,
      contact_person_uuid,
      max_participants,
      work_items (
        id,
        title,
        description,
        work_categories ( name ),
        participants:work_assignments (
          id,
          user_uuid,
          hours_used,
          approved_state,
          approval_comment,
          approved_by_uuid,
          created_at
        )
      )
    `
    )
    .eq('id', Number(taskId))
    .maybeSingle();

  if (error) throw new Error(`Could not get task: ${error.message}`);
  return data ? toAppTask(data as TaskRow) : undefined;
}

const TASK_LIST_COLUMNS = `
      id,
      created_at,
      deadline,
      time_estimate,
      contact_person_uuid,
      max_participants,
      work_items (
        title,
        description,
        work_categories ( name ),
        participants:work_assignments (
          id,
          user_uuid,
          hours_used,
          approved_state,
          approval_comment,
          approved_by_uuid,
          created_at
        )
      )
    `;

export type RecentTasksOptions = {
  since: Date;
  // Also include older tasks this user joined but hasn't sent in yet.
  userId?: string;
};

// Pending assignments without hours are tasks the user joined but hasn't sent in.
async function getUnsubmittedTaskIds(userId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('work_assignments')
    .select('work_id')
    .eq('user_uuid', userId)
    .eq('approved_state', 0)
    .is('hours_used', null);

  if (error) throw new Error(`Could not get tasks: ${error.message}`);
  return (data ?? [])
    .map((row: AssignmentWorkIdRow) => row.work_id)
    .filter((workId): workId is number => workId != null)
    .map(Number);
}

// Same order as the database query: by deadline, tasks without a deadline last.
const compareDeadlines = (a: TaskRow, b: TaskRow): number => {
  if (!a.deadline) return b.deadline ? 1 : 0;
  if (!b.deadline) return -1;
  return a.deadline.localeCompare(b.deadline);
};

// Without options, every task ever created. With `recent`, only tasks created since then,
// tasks that are still open (no deadline, or a deadline from today on), and the user's
// unsubmitted tasks, so the list doesn't grow with every semester.
export async function getTasks(recent?: RecentTasksOptions): Promise<Task[]> {
  let query = supabase.from('work_tasks').select(TASK_LIST_COLUMNS);
  if (recent) {
    query = query.or(
      [
        `created_at.gte.${recent.since.toISOString()}`,
        'deadline.is.null',
        `deadline.gte.${formatDateColumnValue(new Date())}`,
      ].join(',')
    );
  }

  const [{ data, error }, unsubmittedIds] = await Promise.all([
    query.order('deadline', { ascending: true }),
    recent?.userId ? getUnsubmittedTaskIds(recent.userId) : Promise.resolve([]),
  ]);

  if (error) {
    throw new Error(`Could not get tasks: ${error.message}`);
  }

  const rows = (data ?? []) as TaskRow[];
  const loadedIds = new Set(rows.map((row) => Number(row.id)));
  const missingIds = Array.from(new Set(unsubmittedIds)).filter((id) => !loadedIds.has(id));

  if (missingIds.length > 0) {
    const { data: extra, error: extraError } = await supabase
      .from('work_tasks')
      .select(TASK_LIST_COLUMNS)
      .in('id', missingIds);

    if (extraError) {
      throw new Error(`Could not get tasks: ${extraError.message}`);
    }
    rows.push(...((extra ?? []) as TaskRow[]));
    rows.sort(compareDeadlines);
  }

  return rows.map(toAppTask);
}

export async function updateTask(taskId: string, data: Partial<TaskCreationData>): Promise<void> {
  const patchItem: TaskItemPatch = {
    title: data.title,
    description: data.description,
  };
  if (data.category) {
    const { data: categoryRow, error: categoryError } = await supabase
      .from('work_categories')
      .select('id')
      .eq('name', data.category)
      .maybeSingle();

    if (categoryError) throw new Error(`Could not update task: ${categoryError.message}`);
    if (!categoryRow) throw new Error(`Category '${data.category}' not found`);
    patchItem.work_category_id = categoryRow.id;
  }
  (Object.keys(patchItem) as (keyof TaskItemPatch)[]).forEach((key) => {
    if (patchItem[key] === undefined) delete patchItem[key];
  });
  if (Object.keys(patchItem).length) {
    const { error } = await supabase.from('work_items').update(patchItem).eq('id', Number(taskId));
    if (error) throw new Error(`Could not update task: ${error.message}`);
  }

  const patchTask: TaskPatch = {
    deadline: data.deadline ? formatDateColumnValue(data.deadline) : undefined,
    time_estimate: data.hourEstimate,
    contact_person_uuid: data.contactPersonId,
    max_participants: data.maxParticipants,
  };
  (Object.keys(patchTask) as (keyof TaskPatch)[]).forEach((key) => {
    if (patchTask[key] === undefined) delete patchTask[key];
  });
  if (Object.keys(patchTask).length) {
    const { error } = await supabase.from('work_tasks').update(patchTask).eq('id', Number(taskId));
    if (error) throw new Error(`Could not update task: ${error.message}`);
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  const id = Number(taskId);
  const task = await getTaskOrThrow(taskId);

  if (task.participants.length > 0) {
    throw new Error('Kan ikke slette oppgaver som har deltakere eller innsendte timer');
  }

  const { error: e1 } = await supabase.from('work_assignments').delete().eq('work_id', id);
  if (e1) throw new Error(`Could not delete task: ${e1.message}`);
  const { error: e2 } = await supabase.from('work_tasks').delete().eq('id', id);
  if (e2) throw new Error(`Could not delete task: ${e2.message}`);
  const { error: e3 } = await supabase.from('work_items').delete().eq('id', id);
  if (e3) throw new Error(`Could not delete task: ${e3.message}`);
}

export async function joinTask(taskId: string, userId: string): Promise<boolean> {
  const task = await getTaskOrThrow(taskId);

  if (task.isArchived) {
    throw new Error('Oppgaven er arkivert');
  }

  const existingAssignment = await getAssignmentRow(taskId, userId);
  if (existingAssignment) {
    throw new Error('Du er allerede meldt på denne oppgaven');
  }

  const participantCount = task.participants.length;
  if (participantCount >= task.maxParticipants) {
    throw new Error('Oppgaven er full');
  }

  const { error } = await supabase.from('work_assignments').insert({
    work_id: Number(taskId),
    user_uuid: userId,
    approved_state: 0,
    hours_used: null,
  });
  if (error) throw new Error(`Could not join task: ${error.message}`);
  return true;
}

export async function leaveTask(taskId: string, userId: string): Promise<boolean> {
  const assignment = await getAssignmentRow(taskId, userId);
  if (!assignment) {
    throw new Error('Du er ikke meldt på denne oppgaven');
  }

  const status = getTaskAssignmentStatus(assignment);
  if (!canLeaveTaskAssignment(status)) {
    throw new Error('Du kan ikke melde deg av etter at oppgaven er sendt inn eller godkjent');
  }

  const { error } = await supabase.from('work_assignments').delete().eq('id', assignment.id);

  if (error) throw new Error(`Could not leave task: ${error.message}`);
  return true;
}

export async function submitTaskCompletion(taskId: string, userId: string): Promise<void> {
  const task = await getTaskOrThrow(taskId);
  const assignment = await getAssignmentRow(taskId, userId);

  if (!assignment) {
    throw new Error('Du må være påmeldt før du kan sende inn oppgaven');
  }

  const status = getTaskAssignmentStatus(assignment);
  if (!canSubmitTaskAssignment(status)) {
    throw new Error('Oppgaven er allerede sendt inn eller ferdig behandlet');
  }

  if (!task.hourEstimate) {
    throw new Error('Oppgaven mangler timeestimat og kan ikke sendes inn');
  }

  const { error } = await supabase
    .from('work_assignments')
    .update({
      hours_used: task.hourEstimate,
      performed_at: formatDateColumnValue(new Date()),
      approved_state: 0,
      approved_by_uuid: null,
      approval_comment: null,
    })
    .eq('id', assignment.id);

  if (error) {
    throw new Error(`Could not submit task completion: ${error.message}`);
  }
}

export async function getTasksByUser(userId: string): Promise<Task[]> {
  const { data: assignmentRows, error: assignmentError } = await supabase
    .from('work_assignments')
    .select('work_id')
    .eq('user_uuid', userId);

  if (assignmentError) {
    throw new Error(`Could not get tasks by user: ${assignmentError.message}`);
  }

  const taskIds = Array.from(
    new Set(
      (assignmentRows ?? [])
        .map((row: AssignmentWorkIdRow) => row.work_id)
        .filter((workId: number | null | undefined) => workId != null)
    )
  );

  if (taskIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('work_tasks')
    .select(
      `
      id,
      created_at,
      deadline,
      time_estimate,
      contact_person_uuid,
      max_participants,
      work_items (
        title,
        description,
        work_categories ( name ),
        participants:work_assignments (
          id,
          user_uuid,
          hours_used,
          approved_state,
          approval_comment,
          approved_by_uuid,
          created_at
        )
      )
    `
    )
    .in('id', taskIds)
    .order('deadline', { ascending: true });

  if (error) {
    throw new Error(`Could not get tasks by user: ${error.message}`);
  }

  return ((data ?? []) as TaskRow[]).map(toAppTask);
}
