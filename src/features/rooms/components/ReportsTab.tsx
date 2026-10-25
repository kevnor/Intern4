import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import CreateTaskFromReportModal from './CreateTaskFromReportModal';
import ReportList from './ReportList';
import type { RoomReports } from '../hooks/useRoomReports';
import { filterReports, isActiveReport, type ReportFilter } from '../reports';
import type { RoomReport } from '../types';
import {
  Button,
  Card,
  EmptyState,
  SegmentedControl,
  Skeleton,
  StatusMessage,
} from '../../../shared/components';

type ReportsTabProps = {
  reports: RoomReports;
  canCreateTask: boolean;
};

// All room reports, for the people who handle them.
const ReportsTab = ({ reports, canCreateTask }: ReportsTabProps) => {
  const [filter, setFilter] = useState<ReportFilter>('active');
  const [taskFor, setTaskFor] = useState<RoomReport | null>(null);
  const activeCount = reports.reports.filter(isActiveReport).length;
  const visible = filterReports(reports.reports, filter);

  if (reports.loading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      {reports.error && !taskFor && (
        <StatusMessage tone="error" onDismiss={reports.clearError}>
          {reports.error}
        </StatusMessage>
      )}

      <SegmentedControl<ReportFilter>
        label="Filtrer meldinger"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'active', label: `Trenger handling (${activeCount})` },
          { value: 'all', label: `Alle (${reports.reports.length})` },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          title={filter === 'active' ? 'Ingen meldinger venter' : 'Ingen meldinger ennå'}
          icon={<ClipboardList aria-hidden="true" className="h-6 w-6" />}
        >
          Når en beboer melder et problem i rommet sitt, dukker det opp her.
        </EmptyState>
      ) : (
        <Card>
          <ReportList
            reports={visible}
            showRoom
            emptyText="Ingen meldinger."
            renderActions={(report) => (
              <>
                {report.status === 'open' && canCreateTask && (
                  <Button
                    size="sm"
                    onClick={() => {
                      reports.clearError();
                      setTaskFor(report);
                    }}
                  >
                    Lag oppgave
                  </Button>
                )}
                {isActiveReport(report) && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={reports.busy}
                      onClick={() => void reports.changeStatus(report.id, 'resolved')}
                    >
                      Merk som løst
                    </Button>
                    {report.status === 'open' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={reports.busy}
                        onClick={() => void reports.changeStatus(report.id, 'dismissed')}
                      >
                        Avvis
                      </Button>
                    )}
                  </>
                )}
                {!isActiveReport(report) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={reports.busy}
                    onClick={() => void reports.changeStatus(report.id, 'open')}
                  >
                    Åpne igjen
                  </Button>
                )}
              </>
            )}
          />
        </Card>
      )}

      {taskFor && (
        <CreateTaskFromReportModal
          key={taskFor.id}
          report={taskFor}
          busy={reports.busy}
          error={reports.error}
          onCreate={reports.createTask}
          onClose={() => setTaskFor(null)}
        />
      )}
    </div>
  );
};

export default ReportsTab;
