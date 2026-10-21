import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ReportsTab from './ReportsTab';
import type { RoomReports } from '../hooks/useRoomReports';
import type { RoomReport } from '../types';

vi.mock('../../../server/dao/categoriesDAO', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
}));

const report = (overrides: Partial<RoomReport>): RoomReport => ({
  id: 'r1',
  roomId: 'room',
  roomNumber: 214,
  reportedBy: 'u1',
  reporterName: 'Anne Hansen',
  title: 'Ødelagt lås',
  description: null,
  status: 'open',
  workItemId: null,
  createdAt: new Date(2026, 9, 1),
  resolvedAt: null,
  ...overrides,
});

const make = (reports: RoomReport[], overrides: Partial<RoomReports> = {}): RoomReports =>
  ({
    reports,
    loading: false,
    busy: false,
    error: null,
    clearError: vi.fn(),
    report: vi.fn(),
    changeStatus: vi.fn().mockResolvedValue(true),
    withdraw: vi.fn(),
    createTask: vi.fn().mockResolvedValue(true),
    ...overrides,
  }) as RoomReports;

const renderTab = (reports: RoomReports, canCreateTask = true) =>
  render(
    <MemoryRouter>
      <ReportsTab reports={reports} canCreateTask={canCreateTask} />
    </MemoryRouter>
  );

describe('ReportsTab', () => {
  const reports = [
    report({ id: 'open', title: 'Ødelagt lås' }),
    report({
      id: 'task',
      title: 'Mugg',
      status: 'task_created',
      workItemId: '42',
      roomNumber: 150,
    }),
    report({ id: 'done', title: 'Vindu', status: 'resolved', roomNumber: 101 }),
  ];

  it('shows what needs action by default and the rest on request', async () => {
    const user = userEvent.setup();
    renderTab(make(reports));

    expect(screen.getByText(/Ødelagt lås/)).toBeInTheDocument();
    expect(screen.getByText(/Mugg/)).toBeInTheDocument();
    expect(screen.queryByText(/Vindu/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Se oppgaven under Regi' })).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Alle (3)' }));

    expect(screen.getByText(/Vindu/)).toBeInTheDocument();
  });

  it('lets Regisjef make a task from an open report', async () => {
    const user = userEvent.setup();
    const roomReports = make(reports);
    renderTab(roomReports);

    await user.click(screen.getByRole('button', { name: 'Lag oppgave' }));

    expect(await screen.findByText('Fra meldingen «Ødelagt lås» på rom 214.')).toBeInTheDocument();
  });

  it('hides "Lag oppgave" from people who cannot make tasks', () => {
    renderTab(make(reports), false);

    expect(screen.queryByRole('button', { name: 'Lag oppgave' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Merk som løst' })).toHaveLength(2);
  });

  it('marks as resolved, dismisses and reopens', async () => {
    const user = userEvent.setup();
    const roomReports = make(reports);
    renderTab(roomReports);

    const openItem = screen.getByText(/Ødelagt lås/).closest('li')!;
    await user.click(within(openItem).getByRole('button', { name: 'Merk som løst' }));
    await user.click(within(openItem).getByRole('button', { name: 'Avvis' }));
    expect(roomReports.changeStatus).toHaveBeenCalledWith('open', 'resolved');
    expect(roomReports.changeStatus).toHaveBeenCalledWith('open', 'dismissed');

    await user.click(screen.getByRole('radio', { name: 'Alle (3)' }));
    const doneItem = screen.getByText(/Vindu/).closest('li')!;
    await user.click(within(doneItem).getByRole('button', { name: 'Åpne igjen' }));
    expect(roomReports.changeStatus).toHaveBeenCalledWith('done', 'open');
  });

  it('says so when nothing waits', () => {
    renderTab(make([report({ status: 'resolved' })]));

    expect(screen.getByText('Ingen meldinger venter')).toBeInTheDocument();
  });

  it('shows errors from the last action', () => {
    renderTab(make(reports, { error: 'Du har ikke tilgang til å endre meldingen' }));

    expect(screen.getByText('Du har ikke tilgang til å endre meldingen')).toBeInTheDocument();
  });
});
