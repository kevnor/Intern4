import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logIn, signInWithMicrosoft } from './authentication';
import { supabase } from '../supabaseClient';

vi.mock('../supabaseClient', () => ({
  supabase: { auth: { signInWithPassword: vi.fn(), signInWithOAuth: vi.fn() } },
}));

describe('logIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('explains that a deactivated (banned) account cannot log in', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User is banned' },
    } as never);

    await expect(logIn('ola@example.test', 'pw')).resolves.toEqual({
      success: false,
      error: 'Kontoen er deaktivert. Kontakt romsjef eller Data.',
    });
  });

  it('says plainly when the email or password is wrong', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    } as never);

    await expect(logIn('ola@example.test', 'feil')).resolves.toEqual({
      success: false,
      error: 'Feil e-post eller passord.',
    });
  });

  it('explains a lost connection', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await logIn('ola@example.test', 'pw');

    expect(result).toEqual({
      success: false,
      error: 'Innlogging feilet: Failed to fetch',
    });
  });
});

describe('signInWithMicrosoft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends the browser to Microsoft and back to the login page', async () => {
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
      data: { provider: 'azure', url: 'https://login.microsoftonline.com/x' },
      error: null,
    } as never);

    await expect(signInWithMicrosoft()).resolves.toEqual({ success: true });

    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'azure',
      options: { redirectTo: `${window.location.origin}/login`, scopes: 'email' },
    });
  });

  it('keeps a Norwegian message from the server and hides a technical one', async () => {
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValueOnce({
      data: {},
      error: { message: 'Du er ikke registrert som beboer. Kontakt romsjef eller Data.' },
    } as never);
    await expect(signInWithMicrosoft()).resolves.toEqual({
      success: false,
      error: 'Du er ikke registrert som beboer. Kontakt romsjef eller Data.',
    });

    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValueOnce({
      data: {},
      error: { message: 'Unsupported provider: provider is not enabled' },
    } as never);
    await expect(signInWithMicrosoft()).resolves.toEqual({
      success: false,
      error: 'Innlogging med Microsoft feilet. Prøv igjen.',
    });
  });

  it('explains a lost connection', async () => {
    vi.mocked(supabase.auth.signInWithOAuth).mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(signInWithMicrosoft()).resolves.toEqual({
      success: false,
      error: 'Ingen kontakt med serveren. Sjekk nettverket og prøv igjen.',
    });
  });
});
