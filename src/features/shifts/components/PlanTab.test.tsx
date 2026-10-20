import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlanTab from './PlanTab';
import type { Shift } from '../types';

const NOW = new Date(2026, 9, 20, 12);

const shift = (overrides: Partial<Shift>): Shift => ({
  id: 's1',
  startsAt: new Date(2026, 9, 20, 16),
  endsAt: new Date(2026, 9, 21, 0),
  slotType: 'kveld',
  userId: null,
  userName: null,
  status: 'published',
  ...overrides,
});

const renderPlan = (shifts: Shift[], canManage = false, onCreateSlots = vi.fn()) =>
  render(
    <PlanTab
      shifts={shifts}
      loading={false}
      userId="me"
      canManage={canManage}
      onCreateSlots={onCreateSlots}
      now={NOW}
    />
  );

describe('PlanTab', () => {
  it('shows who has each shift and which are free', () => {
    renderPlan([
      shift({ id: 'a', userId: 'me', userName: 'Meg' }),
      shift({
        id: 'b',
        slotType: 'natt',
        startsAt: new Date(2026, 9, 21, 0),
        userId: 'x',
        userName: 'Kari',
      }),
      shift({ id: 'c', startsAt: new Date(2026, 9, 21, 16) }),
    ]);

    expect(screen.getByText('Uke 43 · 19. okt. – 25. okt.')).toBeInTheDocument();
    expect(screen.getByText('Deg')).toBeInTheDocument();
    expect(screen.getByText('Kari')).toBeInTheDocument();
    expect(screen.getByText('Ledig')).toBeInTheDocument();
  });

  it('moves between weeks', async () => {
    const user = userEvent.setup();
    renderPlan([shift({})]);

    await user.click(screen.getByRole('button', { name: 'Neste uke' }));
    expect(screen.getByText(/Uke 44/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'I dag' }));
    expect(screen.getByText(/Uke 43/)).toBeInTheDocument();
  });

  it('lets a manager create the semester’s slots when none exist', async () => {
    const user = userEvent.setup();
    const onCreateSlots = vi.fn().mockResolvedValue(undefined);
    renderPlan([], true, onCreateSlots);

    await user.click(screen.getByRole('button', { name: 'Opprett vakter for semesteret' }));

    expect(onCreateSlots).toHaveBeenCalled();
  });

  it('tells residents the plan is not published when there are no shifts', () => {
    renderPlan([]);

    expect(screen.getByText('Vaktsjefen har ikke publisert vaktplanen ennå.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('warns managers that drafts are hidden from residents', () => {
    renderPlan([shift({ status: 'draft' })], true);

    expect(screen.getByText('Utkast – ikke synlig for beboere')).toBeInTheDocument();
  });
});
