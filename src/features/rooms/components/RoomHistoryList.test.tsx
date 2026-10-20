import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RoomHistoryList, { formatStay } from './RoomHistoryList';
import type { Occupancy } from '../types';

const stay = (overrides: Partial<Occupancy>): Occupancy => ({
  id: 's1',
  roomId: 'r1',
  roomNumber: 214,
  userId: 'u1',
  userName: 'Anne Hansen',
  movedIn: new Date(2025, 7, 1),
  movedOut: null,
  ...overrides,
});

const renderList = (stays: Occupancy[], subject: 'resident' | 'room') =>
  render(
    <MemoryRouter>
      <RoomHistoryList stays={stays} subject={subject} />
    </MemoryRouter>
  );

describe('formatStay', () => {
  it('shows a range for finished stays and "siden" for the current one', () => {
    expect(formatStay({ movedIn: new Date(2025, 7, 1), movedOut: new Date(2026, 5, 15) })).toBe(
      '1.8.2025 – 15.6.2026'
    );
    expect(formatStay({ movedIn: new Date(2025, 7, 1), movedOut: null })).toBe('Siden 1.8.2025');
  });
});

describe('RoomHistoryList', () => {
  it('links to the resident profile when listing a room’s history', () => {
    renderList([stay({})], 'resident');

    expect(screen.getByRole('link', { name: 'Anne Hansen' })).toHaveAttribute(
      'href',
      '/beboere/u1'
    );
  });

  it('links to the room when listing a resident’s rooms', () => {
    renderList([stay({})], 'room');

    expect(screen.getByRole('link', { name: 'Rom 214' })).toHaveAttribute('href', '/rom/alle/214');
  });

  it('says so when there is nothing to show', () => {
    renderList([], 'resident');

    expect(screen.getByText('Ingen tidligere beboere registrert.')).toBeInTheDocument();
  });
});
