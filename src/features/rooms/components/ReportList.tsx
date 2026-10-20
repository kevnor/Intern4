import { Link } from 'react-router-dom';
import { REPORT_STATUS_LABELS } from '../reports';
import { roomPath } from '../paths';
import type { RoomReport, RoomReportStatus } from '../types';
import { REGI_PATHS } from '../../regi/paths';
import { Badge, type BadgeTone } from '../../../shared/components';
import { formatDate } from '../../../shared/utils/date';

const STATUS_TONES: Record<RoomReportStatus, BadgeTone> = {
  open: 'warning',
  task_created: 'info',
  resolved: 'success',
  dismissed: 'neutral',
};

type ReportListProps = {
  reports: RoomReport[];
  emptyText: string;
  // Shows which room each report is about; leave out on a single room's page.
  showRoom?: boolean;
  // Buttons for a report, e.g. "Lag oppgave" or "Trekk tilbake".
  renderActions?: (report: RoomReport) => React.ReactNode;
};

const ReportList = ({ reports, emptyText, showRoom = false, renderActions }: ReportListProps) => {
  if (reports.length === 0) return <p className="text-sm text-subtle">{emptyText}</p>;

  return (
    <ul className="divide-y divide-border">
      {reports.map((report) => (
        <li key={report.id} className="space-y-2 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium">
                {showRoom && (
                  <>
                    <Link to={roomPath(report.roomNumber)} className="text-primary hover:underline">
                      Rom {report.roomNumber}
                    </Link>
                    {' · '}
                  </>
                )}
                {report.title}
              </p>
              <p className="text-sm text-muted">
                {report.reporterName} · {formatDate(report.createdAt)}
              </p>
            </div>
            <Badge tone={STATUS_TONES[report.status]}>{REPORT_STATUS_LABELS[report.status]}</Badge>
          </div>
          {report.description && (
            <p className="whitespace-pre-line text-sm text-muted">{report.description}</p>
          )}
          {report.workItemId && (
            <Link
              to={REGI_PATHS.OPPGAVER}
              className="inline-block text-sm text-primary hover:underline"
            >
              Se oppgaven under Regi
            </Link>
          )}
          {renderActions && <div className="flex flex-wrap gap-2">{renderActions(report)}</div>}
        </li>
      ))}
    </ul>
  );
};

export default ReportList;
