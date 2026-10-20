import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import RoomWorkList, { totalApprovedHours } from './RoomWorkList';
import type { RoomWork } from '../types';

const entry = (overrides: Partial<RoomWork>): RoomWork => ({
  id: 'w1',
  title: 'Malte veggen',
  isTask: false,
  hours: 2,
  performedAt: new Date(2026, 9, 5),
  userName: 'Anne Hansen',
  approved: true,
  ...overrides,
});

describe('totalApprovedHours', () => {
  it('only adds up work that has been confirmed', () => {
    expect(
      totalApprovedHours([
        entry({ hours: 2 }),
        entry({ id: 'w2', hours: 1.5 }),
        entry({ id: 'w3', hours: 4, approved: false }),
      ])
    ).toBe(3.5);
  });
});

describe('RoomWorkList', () => {
  it('lists who did what and when, and marks work waiting for approval', () => {
    render(
      <RoomWorkList
        work={[
          entry({}),
          entry({ id: 'w2', title: 'Ødelagt lås', isTask: true, approved: false, userName: 'Bo' }),
        ]}
      />
    );

    expect(screen.getByText('Malte veggen')).toBeInTheDocument();
    expect(screen.getByText('Anne Hansen · 5.10.2026')).toBeInTheDocument();
    expect(screen.getByText(/oppgave/)).toBeInTheDocument();
    // Only the unconfirmed entry is marked.
    expect(screen.getAllByText('Venter på godkjenning')).toHaveLength(1);
  });

  it('says so when nothing has been done', () => {
    render(<RoomWorkList work={[]} />);

    expect(screen.getByText('Ingen arbeid er registrert på rommet ennå.')).toBeInTheDocument();
  });
});
