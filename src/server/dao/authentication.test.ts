import { describe, expect, it, vi } from 'vitest';
import { logIn } from './authentication';
import { supabase } from '../supabaseClient';

vi.mock('../supabaseClient', () => ({
  supabase: { auth: { signInWithPassword: vi.fn() } },
}));

describe('logIn', () => {
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
});
