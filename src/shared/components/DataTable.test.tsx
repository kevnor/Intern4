import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable } from './DataTable';

type Row = { id: string; name: string; hours: number };

const rows: Row[] = [
  { id: '1', name: 'Vaske kjøkken', hours: 2 },
  { id: '2', name: 'Male gang', hours: 4 },
];

const columns = [
  { key: 'name', header: 'Oppgave', render: (row: Row) => row.name },
  { key: 'hours', header: 'Timer', render: (row: Row) => row.hours },
];

describe('DataTable', () => {
  it('renders both a card list and a table when renderCard is given', () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        renderCard={(row) => <span>Kort: {row.name}</span>}
      />
    );

    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Kort: Vaske kjøkken')).toBeInTheDocument();
    expect(screen.getByRole('table').parentElement).toHaveClass('hidden', 'md:block');
  });

  it('only renders the table without renderCard', () => {
    render(<DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} />);

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Oppgave' })).toBeInTheDocument();
  });

  it('makes clickable rows keyboard-operable', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        onRowClick={onRowClick}
        getRowLabel={(row) => `Åpne ${row.name}`}
      />
    );

    screen.getByRole('row', { name: 'Åpne Male gang' }).focus();
    await user.keyboard('{Enter}');

    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });

  it('shows the empty message when there are no rows', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowKey={(row: Row) => row.id}
        emptyMessage="Ingen oppgaver"
      />
    );

    expect(screen.getByText('Ingen oppgaver')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
