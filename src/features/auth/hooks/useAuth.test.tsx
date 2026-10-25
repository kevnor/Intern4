import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useProvideAuth } from './useAuth';
import { supabase } from '../../../server/supabaseClient';
import { clearSignedUrlCache } from '../../../server/storage';
import { DEACTIVATED_MESSAGE, NO_PROFILE_MESSAGE } from '../authErrors';

vi.mock('../../../server/supabaseClient', () => ({
  supabase: {
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn() },
    from: vi.fn(),
  },
}));
vi.mock('../../../server/storage', () => ({ clearSignedUrlCache: vi.fn() }));

type Session = { user: Record<string, unknown> } | null;
type StateCallback = (event: string, session: Session) => void;

let emit: StateCallback;
const unsubscribe = vi.fn();

const sessionFor = (providers: string[] = ['email']): Session => ({
  user: {
    id: 'user-1',
    email: 'Kari@Example.no',
    identities: providers.map((provider) => ({ provider })),
  },
});

const profile = (overrides: Record<string, unknown> = {}) => ({
  name: 'Kari Nordmann',
  email: 'kari@example.no',
  is_active: true,
  roles: { name: 'Halv/Halv' },
  ...overrides,
});

const answerProfile = (result: { data: unknown; error: unknown }) => {
  vi.mocked(supabase.from).mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: async () => result }) }),
  } as never);
};

const setup = async () => {
  const hook = renderHook(() => useProvideAuth());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
};

describe('useProvideAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(((callback: StateCallback) => {
      emit = callback;
      return { data: { subscription: { unsubscribe } } };
    }) as never);
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null } as never);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('has no user when nobody is signed in', async () => {
    const { result } = await setup();

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(clearSignedUrlCache).toHaveBeenCalled();
  });

  it('loads the profile, role and how the person signs in', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: sessionFor(['email', 'azure']) },
    } as never);
    answerProfile({ data: profile(), error: null });

    const { result } = await setup();

    expect(result.current.user).toEqual({
      id: 'user-1',
      name: 'Kari Nordmann',
      email: 'kari@example.no',
      role: 'Halv/Halv',
      providers: ['email', 'azure'],
    });
    expect(result.current.error).toBeNull();
  });

  it('signs out a login that has no profile, and says why', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: sessionFor() },
    } as never);
    answerProfile({ data: null, error: null });

    const { result } = await setup();

    expect(result.current.user).toBeNull();
    expect(result.current.error).toBe(NO_PROFILE_MESSAGE);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(clearSignedUrlCache).toHaveBeenCalled();
  });

  it('signs out a deactivated resident, and says why', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: sessionFor() },
    } as never);
    answerProfile({ data: profile({ is_active: false }), error: null });

    const { result } = await setup();

    expect(result.current.user).toBeNull();
    expect(result.current.error).toBe(DEACTIVATED_MESSAGE);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('does not lock someone out when the profile simply has no active flag', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: sessionFor() },
    } as never);
    answerProfile({ data: profile({ is_active: null }), error: null });

    const { result } = await setup();

    expect(result.current.user?.id).toBe('user-1');
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('keeps the user signed in, without a role, when the profile cannot be read', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: sessionFor(['azure']) },
    } as never);
    answerProfile({ data: null, error: { message: 'timeout' } });

    const { result } = await setup();

    expect(result.current.user).toEqual({
      id: 'user-1',
      email: 'Kari@Example.no',
      providers: ['azure'],
    });
    expect(result.current.error).toBe('Kunne ikke laste brukerprofil');
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('finishes a first Microsoft sign-in, which arrives as a state change', async () => {
    answerProfile({ data: profile(), error: null });
    const { result } = await setup();
    expect(result.current.user).toBeNull();

    await act(async () => {
      emit('SIGNED_IN', sessionFor(['azure']));
    });

    await waitFor(() => expect(result.current.user?.name).toBe('Kari Nordmann'));
    expect(result.current.user?.providers).toEqual(['azure']);
    expect(result.current.loading).toBe(false);
  });

  it('refuses a Microsoft sign-in that arrives for someone without a profile', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    answerProfile({ data: null, error: null });
    const { result } = await setup();

    await act(async () => {
      emit('SIGNED_IN', sessionFor(['azure']));
    });

    await waitFor(() => expect(result.current.error).toBe(NO_PROFILE_MESSAGE));
    expect(result.current.user).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('clears the signed-URL cache whenever the user signs out', async () => {
    answerProfile({ data: profile(), error: null });
    await setup();
    vi.mocked(clearSignedUrlCache).mockClear();

    await act(async () => {
      emit('SIGNED_OUT', null);
    });

    expect(clearSignedUrlCache).toHaveBeenCalledTimes(1);
  });

  it('forgets an old error when the user signs out themselves, and when told to', async () => {
    answerProfile({ data: null, error: { message: 'timeout' } });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: sessionFor() },
    } as never);
    const { result } = await setup();
    expect(result.current.error).toBe('Kunne ikke laste brukerprofil');

    await act(async () => {
      await result.current.logout();
    });
    expect(result.current.error).toBeNull();

    answerProfile({ data: null, error: { message: 'timeout' } });
    await act(async () => {
      emit('SIGNED_IN', sessionFor());
    });
    await waitFor(() => expect(result.current.error).toBe('Kunne ikke laste brukerprofil'));
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });

  it('stops listening when it unmounts', async () => {
    const { unmount } = await setup();

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
