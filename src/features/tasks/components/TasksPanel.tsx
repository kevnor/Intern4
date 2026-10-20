import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import TasksTable from './TasksTable';
import { ParticipantNames } from './types';
import { useTasks } from '../hooks/useTasks';
import { Button, SearchInput, SegmentedControl, Skeleton } from '../../../shared/components';
import { Category, Task } from '../../../shared/types/regi/tasks';
import { cn } from '../../../shared/utils/cn';

const FILTER_OPTIONS = [
  { value: 'available', label: 'Ledige' },
  { value: 'myTasks', label: 'Mine' },
  { value: 'all', label: 'Alle' },
];

const chipClasses = (active: boolean) =>
  cn(
    'inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors pointer-coarse:min-h-10',
    active
      ? 'border-primary bg-primary-subtle text-primary-subtle-fg'
      : 'border-border bg-surface text-muted hover:border-border-strong hover:text-fg'
  );

type TasksPanelProps = {
  taskList: ReturnType<typeof useTasks>;
  categories: Category[];
  participantNames: ParticipantNames;
  currentUserId?: string;
  loading: boolean;
  busyTaskId: string | null;
  onOpen: (task: Task) => void;
  onJoin: (taskId: string) => void;
  onSubmit: (task: Task) => void;
  // Set while only recent tasks are loaded; shows "Vis eldre oppgaver" under Alle.
  onShowOlder?: () => void;
  loadingOlder?: boolean;
};

// Filters, list and pagination for tasks. Dialogs live in TaskDialogs.
const TasksPanel: React.FC<TasksPanelProps> = ({
  taskList,
  categories,
  participantNames,
  currentUserId,
  loading,
  busyTaskId,
  onOpen,
  onJoin,
  onSubmit,
  onShowOlder,
  loadingOlder = false,
}) => {
  const {
    query,
    setQuery,
    filter,
    setFilter,
    category,
    setCategory,
    currentPage,
    paginatedTasks,
    totalPages,
    nextPage,
    prevPage,
    filteredTasks,
  } = taskList;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Søk etter oppgaver, kategorier eller kontaktperson..."
            label="Søk etter oppgaver"
            className="flex-1"
          />
          <SegmentedControl
            label="Vis oppgaver"
            options={FILTER_OPTIONS}
            value={filter}
            onChange={setFilter}
            className="w-full md:w-auto"
          />
        </div>

        <div
          role="group"
          aria-label="Filtrer på kategori"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
        >
          <button
            type="button"
            aria-pressed={category === 'all'}
            onClick={() => setCategory('all')}
            className={chipClasses(category === 'all')}
          >
            Alle kategorier
          </button>
          {categories.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={category === item.name}
              onClick={() => setCategory(category === item.name ? 'all' : item.name)}
              className={chipClasses(category === item.name)}
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div aria-busy="true" className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-32 rounded-2xl md:h-14" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <TasksTable
            tasks={paginatedTasks}
            categories={categories}
            onRowClick={onOpen}
            onJoinTask={onJoin}
            onSubmitTask={onSubmit}
            busyTaskId={busyTaskId}
            currentUserId={currentUserId}
            participantNames={participantNames}
          />

          {totalPages > 1 && (
            <nav
              aria-label="Sider"
              className="flex flex-col items-center justify-between gap-3 sm:flex-row"
            >
              <p className="text-sm text-muted">
                Viser {paginatedTasks.length} av {filteredTasks.length} oppgaver
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<ChevronLeft aria-hidden="true" className="h-4 w-4" />}
                  onClick={prevPage}
                  disabled={currentPage === 1}
                >
                  Forrige
                </Button>
                <span className="px-2 text-sm tabular-nums text-muted">
                  Side {currentPage} av {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={nextPage}
                  disabled={currentPage === totalPages}
                >
                  Neste
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
            </nav>
          )}

          {filter === 'all' && onShowOlder && (
            <div className="flex flex-col items-center gap-2 pt-2 text-center">
              <p className="text-sm text-muted">
                Viser oppgaver fra dette semesteret og oppgaver som fortsatt er åpne.
              </p>
              <Button variant="secondary" size="sm" onClick={onShowOlder} loading={loadingOlder}>
                Vis eldre oppgaver
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TasksPanel;
