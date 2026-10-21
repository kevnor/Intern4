import { canManageTasks } from '../tasks/permissions';
import { isUserRole, USER_ROLES, type UserRole } from '../../shared/types/roles';
import type { RoomReport, RoomReportStatus } from './types';

export const REPORT_STATUS_LABELS: Record<RoomReportStatus, string> = {
  open: 'Åpen',
  task_created: 'Oppgave opprettet',
  resolved: 'Løst',
  dismissed: 'Avvist',
};

// Regisjef makes the task; Romsjef, Data and Admin follow the reports.
const reportHandlerRoles: UserRole[] = [
  USER_ROLES.ADMIN,
  USER_ROLES.DATA,
  USER_ROLES.WORKMANAGER,
  USER_ROLES.ROOMMANAGER,
];

// Keep in sync with is_room_report_manager() in the database.
export const canHandleReports = (role?: string) =>
  isUserRole(role) && reportHandlerRoles.includes(role);

// Making a task needs the same rights as the Regi task list.
export const canCreateTaskFromReport = canManageTasks;

// Still needs attention: nothing has been done, or a task is waiting to be done.
export const isActiveReport = (report: Pick<RoomReport, 'status'>): boolean =>
  report.status === 'open' || report.status === 'task_created';

export type ReportFilter = 'active' | 'all';

// Open reports first (oldest first, so nothing waits forever), then the rest, newest first.
export const sortReports = (reports: RoomReport[]): RoomReport[] =>
  [...reports].sort((a, b) => {
    const aActive = isActiveReport(a);
    if (aActive !== isActiveReport(b)) return aActive ? -1 : 1;
    return aActive
      ? a.createdAt.getTime() - b.createdAt.getTime()
      : b.createdAt.getTime() - a.createdAt.getTime();
  });

export const filterReports = (reports: RoomReport[], filter: ReportFilter): RoomReport[] =>
  sortReports(filter === 'all' ? reports : reports.filter(isActiveReport));

// The task Regisjef starts from, filled in from the report.
export const taskDraftFromReport = (
  report: Pick<RoomReport, 'roomNumber' | 'title' | 'description' | 'reporterName'>
) => ({
  title: `Rom ${report.roomNumber}: ${report.title}`,
  description: [
    report.description?.trim(),
    `Meldt av ${report.reporterName} (rom ${report.roomNumber}).`,
  ]
    .filter(Boolean)
    .join('\n\n'),
});
