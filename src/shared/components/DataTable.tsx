import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from '../utils/cn';

type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: ReactNode;
  // When given, phones get a list of cards instead of the table.
  renderCard?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  getRowLabel?: (row: T) => string;
  // renderCard returns a complete card with its own surface and buttons, so it gets no
  // wrapper (a wrapping <button> around nested buttons would be invalid HTML).
  bareCards?: boolean;
};

const activateOnKey = (event: KeyboardEvent, action: () => void) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
};

export const DataTable = <T,>({
  columns,
  rows,
  getRowKey,
  emptyMessage = 'Ingen data.',
  renderCard,
  onRowClick,
  getRowLabel,
  bareCards = false,
}: DataTableProps<T>) => {
  if (rows.length === 0) {
    // Strings get the default box; elements such as <EmptyState> render as given.
    return typeof emptyMessage === 'string' ? (
      <div className="rounded-2xl border border-dashed border-border-strong bg-surface px-4 py-8 text-center text-sm text-muted">
        {emptyMessage}
      </div>
    ) : (
      <>{emptyMessage}</>
    );
  }

  return (
    <>
      {renderCard && (
        <ul className="space-y-3 md:hidden">
          {rows.map((row) => (
            <li key={getRowKey(row)}>
              {bareCards ? (
                renderCard(row)
              ) : onRowClick ? (
                <button
                  type="button"
                  onClick={() => onRowClick(row)}
                  aria-label={getRowLabel?.(row)}
                  className="block w-full rounded-2xl border border-border bg-surface p-4 text-left shadow-sm transition-colors hover:border-border-strong active:bg-surface-muted"
                >
                  {renderCard(row)}
                </button>
              ) : (
                <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
                  {renderCard(row)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div
        className={cn(
          'overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm',
          renderCard && 'hidden md:block'
        )}
      >
        <table className="min-w-full text-sm">
          <thead className="bg-surface-muted">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted',
                    column.className
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick ? (event) => activateOnKey(event, () => onRowClick(row)) : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick ? getRowLabel?.(row) : undefined}
                className={cn(
                  onRowClick &&
                    'cursor-pointer hover:bg-surface-muted focus-visible:bg-surface-muted'
                )}
              >
                {columns.map((column) => (
                  <td key={column.key} className={cn('px-4 py-3 text-fg', column.className)}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
