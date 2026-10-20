import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminTab from './AdminTab';
import type { useVaktAdmin } from '../hooks/useVaktAdmin';

const makeAdmin = (stats: { total: number; filled: number; drafts: number; published: number }) =>
  ({
    users: [],
    rows: [],
    stats,
    unavailability: [],
    loading: false,
    busy: false,
    error: null,
    lastRun: null,
    autoAssign: vi.fn(),
    clearDrafts: vi.fn(),
    publish: vi.fn(),
    assignShift: vi.fn(),
  }) as unknown as ReturnType<typeof useVaktAdmin>;

describe('AdminTab', () => {
  it('explains why the draft actions are off once everything is published', () => {
    render(<AdminTab admin={makeAdmin({ total: 350, filled: 318, drafts: 0, published: 350 })} />);

    expect(screen.getByText(/Alle vakter er publisert/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nullstill utkast' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Fordel automatisk' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Publiser' })).toBeDisabled();
  });

  it('enables the draft actions while there are drafts', () => {
    render(<AdminTab admin={makeAdmin({ total: 350, filled: 0, drafts: 350, published: 0 })} />);

    expect(screen.queryByText(/Alle vakter er publisert/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nullstill utkast' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Fordel automatisk' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Publiser' })).toBeEnabled();
  });
});
