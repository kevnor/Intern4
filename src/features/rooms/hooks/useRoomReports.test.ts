import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useRoomReports } from './useRoomReports';
import {
  createRoomReport,
  getRoomReports,
  linkReportToTask,
  setReportStatus,
  withdrawRoomReport,
} from '../../../server/dao/roomReportsDAO';
import { addTask } from '../../../server/dao/tasksDAO';

vi.mock('../../../server/dao/tasksDAO', () => ({ addTask: vi.fn() }));

const setup = async (options = {}) => {
  const hook = renderHook(() => useRoomReports(options));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
};

describe('useRoomReports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(addTask).mockResolvedValue('42');
  });

  it('loads the reports for a room', async () => {
    await setup({ roomId: 'r1' });

    expect(getRoomReports).toHaveBeenCalledWith('r1');
  });

  it('does not load anything when disabled', async () => {
    renderHook(() => useRoomReports({ enabled: false }));

    expect(getRoomReports).not.toHaveBeenCalled();
  });

  it('sends a report and reloads', async () => {
    const { result } = await setup();

    let ok = false;
    await act(async () => {
      ok = await result.current.report({
        roomId: 'r1',
        reportedBy: 'u1',
        title: 'Lås',
        description: 'Ødelagt',
      });
    });

    expect(ok).toBe(true);
    expect(createRoomReport).toHaveBeenCalledWith({
      roomId: 'r1',
      reportedBy: 'u1',
      title: 'Lås',
      description: 'Ødelagt',
    });
    expect(getRoomReports).toHaveBeenCalledTimes(2);
  });

  it('changes status and withdraws', async () => {
    const { result } = await setup();

    await act(async () => {
      await result.current.changeStatus('a', 'resolved');
      await result.current.withdraw('b');
    });

    expect(setReportStatus).toHaveBeenCalledWith('a', 'resolved');
    expect(withdrawRoomReport).toHaveBeenCalledWith('b');
  });

  it('creates the task and links the report to it', async () => {
    const { result } = await setup();
    const task = {
      title: 'Rom 214: Lås',
      category: 'Vedlikehold',
      hourEstimate: 2,
      maxParticipants: 1,
    };

    await act(async () => {
      await result.current.createTask('a', task);
    });

    expect(addTask).toHaveBeenCalledWith(task);
    expect(linkReportToTask).toHaveBeenCalledWith('a', '42');
  });

  it('says the task exists when only the linking failed, so it is not created twice', async () => {
    vi.mocked(linkReportToTask).mockRejectedValueOnce(new Error('nope'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await setup();

    let ok = true;
    await act(async () => {
      ok = await result.current.createTask('a', {
        title: 'T',
        category: 'Vedlikehold',
        hourEstimate: 1,
        maxParticipants: 1,
      });
    });

    expect(ok).toBe(false);
    expect(result.current.error).toMatch(/Oppgaven ble opprettet/);
  });

  it('shows the database message when something is refused', async () => {
    vi.mocked(withdrawRoomReport).mockRejectedValueOnce(
      new Error('Meldingen kan ikke trekkes tilbake')
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await setup();

    await act(async () => {
      await result.current.withdraw('a');
    });

    expect(result.current.error).toBe('Meldingen kan ikke trekkes tilbake');
  });
});
