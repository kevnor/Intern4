import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RomslippTab from './RomslippTab';
import type { RomslippController } from '../hooks/useRomslipp';
import type { AvailableRoom, RomslippParticipant, RomslippState } from '../types';

const participant = (
  position: number,
  name: string,
  overrides: Partial<RomslippParticipant> = {}
): RomslippParticipant => ({
  userId: `u${position}`,
  userName: name,
  position,
  status: 'waiting',
  fromRoomNumber: 100 + position,
  chosenRoomId: null,
  chosenRoomNumber: null,
  answeredAt: null,
  answeredByName: null,
  ...overrides,
});

const open = (participants: RomslippParticipant[]): RomslippState => ({
  round: {
    id: 'round',
    semesterKey: '2026-H',
    status: 'open',
    createdAt: new Date(2026, 9, 1),
    closedAt: null,
  },
  participants,
});

const rooms: AvailableRoom[] = [
  { roomId: 'r273', number: 273, type: null, freeSpots: 1 },
  { roomId: 'r150', number: 150, type: 'liten_parhybel', freeSpots: 2 },
];

const make = (
  state: RomslippState | null,
  overrides: Partial<RomslippController> = {}
): RomslippController =>
  ({
    state,
    available: rooms,
    loading: false,
    busy: false,
    error: null,
    clearError: vi.fn(),
    reload: vi.fn(),
    start: vi.fn().mockResolvedValue(true),
    answer: vi.fn().mockResolvedValue(true),
    skip: vi.fn().mockResolvedValue(true),
    close: vi.fn().mockResolvedValue(true),
    cancel: vi.fn().mockResolvedValue(true),
    ...overrides,
  }) as RomslippController;

const renderTab = (romslipp: RomslippController, userId = 'u1', canManage = false) =>
  render(<RomslippTab romslipp={romslipp} userId={userId} canManage={canManage} />);

describe('RomslippTab with no round', () => {
  it('tells residents nothing is going on', () => {
    renderTab(make(null));

    expect(screen.getByText('Ingen romslipp pågår')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start romslipp' })).not.toBeInTheDocument();
  });

  it('lets Romsjef start one after confirming', async () => {
    const user = userEvent.setup();
    const romslipp = make(null);
    renderTab(romslipp, 'u1', true);

    await user.click(screen.getByRole('button', { name: 'Start romslipp' }));
    const dialog = screen.getByRole('dialog', { name: 'Starte romslipp?' });
    await user.click(within(dialog).getByRole('button', { name: 'Start romslipp' }));

    expect(romslipp.start).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-[HV]$/));
  });
});

describe('RomslippTab errors', () => {
  it('shows why a round could not be started inside the dialog', async () => {
    const user = userEvent.setup();
    const romslipp = make(null, { error: 'Et romslipp pågår allerede' });
    renderTab(romslipp, 'u1', true);

    await user.click(screen.getByRole('button', { name: 'Start romslipp' }));

    const dialog = screen.getByRole('dialog', { name: 'Starte romslipp?' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Et romslipp pågår allerede');
    // The stale error is cleared when the dialog opens.
    expect(romslipp.clearError).toHaveBeenCalled();
  });

  it('shows why closing failed inside the dialog', async () => {
    const user = userEvent.setup();
    const done = make(open([participant(1, 'Anne', { status: 'stayed' })]), {
      error: 'Rom 273 er blitt fullt siden romslippet startet',
    });
    renderTab(done, 'manager', true);

    await user.click(screen.getByRole('button', { name: 'Avslutt romslipp' }));

    const dialog = screen.getByRole('dialog', { name: 'Avslutte romslippet?' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Rom 273 er blitt fullt');
  });
});

describe('RomslippTab during a round', () => {
  const participants = [
    participant(1, 'Anne', { status: 'moved', chosenRoomId: 'r9', chosenRoomNumber: 273 }),
    participant(2, 'Bo'),
    participant(3, 'Cia'),
  ];

  it('shows the order, progress and what has been decided', () => {
    renderTab(make(open(participants)), 'u3');

    expect(screen.getByText('1 av 3')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Flytter fra 101 til 273')).toBeInTheDocument();
    expect(within(table).getByText('På tur')).toBeInTheDocument();
    expect(within(table).getByText(/Cia/)).toBeInTheDocument();
  });

  it('tells a resident who is not up yet how many are ahead', () => {
    renderTab(make(open(participants)), 'u3');

    expect(
      screen.getByText(/Du er nummer 3 i køen\. 1 beboer skal svare før deg\./)
    ).toBeInTheDocument();
    expect(screen.queryByText('Det er din tur')).not.toBeInTheDocument();
  });

  it('lets the resident on turn move to an available room', async () => {
    const user = userEvent.setup();
    const romslipp = make(open(participants));
    renderTab(romslipp, 'u2');

    expect(screen.getByText('Det er din tur')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/Rom du kan flytte til/), 'r150');
    await user.click(screen.getByRole('button', { name: 'Flytt til valgt rom' }));

    expect(romslipp.answer).toHaveBeenCalledWith('r150');
  });

  it('lets the resident on turn stay', async () => {
    const user = userEvent.setup();
    const romslipp = make(open(participants));
    renderTab(romslipp, 'u2');

    await user.click(screen.getByRole('button', { name: 'Jeg blir boende' }));

    expect(romslipp.answer).toHaveBeenCalledWith(null);
  });

  it('needs a room to be picked before moving', () => {
    renderTab(make(open(participants)), 'u2');

    expect(screen.getByRole('button', { name: 'Flytt til valgt rom' })).toBeDisabled();
  });

  it('confirms an answer already given', () => {
    const answered = [participants[0], participants[1], participants[2]];
    renderTab(make(open(answered)), 'u1');

    expect(screen.getByText('Du har svart: Flytter fra 101 til 273.')).toBeInTheDocument();
  });

  it('says a resident outside the round is not part of it', () => {
    renderTab(make(open(participants)), 'stranger');

    expect(screen.getByText(/Du er ikke med i dette romslippet/)).toBeInTheDocument();
  });

  it('shows the rooms that are free right now', () => {
    renderTab(make(open(participants)), 'u3');

    expect(
      screen.getByText('273 · Ikke satt · 1 ledig plass', { selector: 'li' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('150 · Liten parhybel · 2 ledige plasser', { selector: 'li' })
    ).toBeInTheDocument();
  });

  it('shows what the database refused', () => {
    renderTab(make(open(participants), { error: 'Det er ikke din tur' }), 'u3');

    expect(screen.getByText('Det er ikke din tur')).toBeInTheDocument();
  });
});

describe('RomslippTab for Romsjef', () => {
  const participants = [
    participant(1, 'Anne', { status: 'stayed' }),
    participant(2, 'Bo'),
    participant(3, 'Cia'),
  ];

  it('answers for the resident on turn, or skips them', async () => {
    const user = userEvent.setup();
    const romslipp = make(open(participants));
    renderTab(romslipp, 'manager', true);

    expect(screen.getByText(/Svar for/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bo blir boende' }));
    await user.click(screen.getByRole('button', { name: 'Hopp over Bo' }));

    expect(romslipp.answer).toHaveBeenCalledWith(null, 'u2');
    expect(romslipp.skip).toHaveBeenCalledWith('u2');
  });

  it('can only close once everyone has answered, and confirms first', async () => {
    const user = userEvent.setup();
    const waiting = make(open(participants));
    const { unmount } = renderTab(waiting, 'manager', true);
    expect(screen.getByRole('button', { name: 'Avslutt romslipp' })).toBeDisabled();
    unmount();

    const done = make(
      open([
        participant(1, 'Anne', { status: 'moved', chosenRoomId: 'r9', chosenRoomNumber: 273 }),
        participant(2, 'Bo', { status: 'stayed' }),
      ])
    );
    renderTab(done, 'manager', true);
    await user.click(screen.getByRole('button', { name: 'Avslutt romslipp' }));
    const dialog = screen.getByRole('dialog', { name: 'Avslutte romslippet?' });
    expect(within(dialog).getByText(/1 beboere flytter/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Avslutt og flytt' }));

    expect(done.close).toHaveBeenCalled();
  });

  it('cancels only after confirming', async () => {
    const user = userEvent.setup();
    const romslipp = make(open(participants));
    renderTab(romslipp, 'manager', true);

    await user.click(screen.getByRole('button', { name: 'Avbryt romslipp' }));
    const dialog = screen.getByRole('dialog', { name: 'Avbryte romslippet?' });
    expect(romslipp.cancel).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Avbryt romslipp' }));

    expect(romslipp.cancel).toHaveBeenCalled();
  });

  it('is not offered to residents', () => {
    renderTab(make(open(participants)), 'u3', false);

    expect(screen.queryByRole('button', { name: 'Avslutt romslipp' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Svar for/)).not.toBeInTheDocument();
  });
});

describe('RomslippTab after a round', () => {
  it('shows the result of a finished round and lets Romsjef start a new one', () => {
    const state: RomslippState = {
      round: {
        id: 'round',
        semesterKey: '2026-H',
        status: 'closed',
        createdAt: new Date(2026, 9, 1),
        closedAt: new Date(2026, 9, 5),
      },
      participants: [
        participant(1, 'Anne', { status: 'moved', chosenRoomId: 'r9', chosenRoomNumber: 273 }),
      ],
    };
    renderTab(make(state), 'u1', true);

    expect(screen.getByText('Siste romslipp (2026-H) – avsluttet')).toBeInTheDocument();
    // The phone cards and the desktop table are both in the DOM.
    expect(screen.getAllByText('Flytter fra 101 til 273').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Start romslipp' })).toBeInTheDocument();
  });
});
