import { describe, expect, it } from 'vitest';
import {
  DEACTIVATED_MESSAGE,
  MICROSOFT_CANCELLED_MESSAGE,
  MICROSOFT_FAILED_MESSAGE,
  MICROSOFT_NO_EMAIL_MESSAGE,
  NO_PROFILE_MESSAGE,
  getAuthErrorFromUrl,
} from './authErrors';

const at = (search: string, hash = '') => getAuthErrorFromUrl({ search, hash });

describe('getAuthErrorFromUrl', () => {
  it('is null when the address has no error', () => {
    expect(at('')).toBeNull();
    expect(at('?code=abc123')).toBeNull();
    expect(at('', '#access_token=x&type=recovery')).toBeNull();
  });

  it('shows our own Norwegian refusal as it is', () => {
    expect(
      at(`?error=server_error&error_description=${encodeURIComponent(NO_PROFILE_MESSAGE)}`)
    ).toBe(NO_PROFILE_MESSAGE);
    // Supabase sometimes uses + for spaces.
    expect(
      at('?error=server_error&error_description=Du+er+ikke+registrert+som+beboer.+Kontakt+romsjef.')
    ).toBe('Du er ikke registrert som beboer. Kontakt romsjef.');
  });

  it('reads the error from the hash as well as the query', () => {
    expect(
      at('', `#error=access_denied&error_description=${encodeURIComponent(NO_PROFILE_MESSAGE)}`)
    ).toBe(NO_PROFILE_MESSAGE);
  });

  it('says the account is deactivated for a banned login', () => {
    expect(at('?error=access_denied&error_description=User+is+banned')).toBe(DEACTIVATED_MESSAGE);
  });

  it('says when Microsoft did not give an email address', () => {
    expect(
      at('?error=server_error&error_description=Error+getting+user+email+from+external+provider')
    ).toBe(MICROSOFT_NO_EMAIL_MESSAGE);
  });

  it('treats a refusal in the Microsoft prompt as a cancelled sign-in', () => {
    expect(at('?error=access_denied&error_description=The+user+denied+access')).toBe(
      MICROSOFT_CANCELLED_MESSAGE
    );
  });

  it('falls back to a plain message for anything technical', () => {
    expect(at('?error=server_error&error_description=Database+error+saving+new+user')).toBe(
      MICROSOFT_FAILED_MESSAGE
    );
    expect(at('?error=server_error')).toBe(MICROSOFT_FAILED_MESSAGE);
  });
});
