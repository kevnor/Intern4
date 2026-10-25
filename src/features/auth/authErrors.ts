import { getErrorMessage } from '../../shared/utils/errors';

export const NO_PROFILE_MESSAGE = 'Du er ikke registrert som beboer. Kontakt romsjef eller Data.';
export const DEACTIVATED_MESSAGE = 'Kontoen er deaktivert. Kontakt romsjef eller Data.';
export const MICROSOFT_CANCELLED_MESSAGE = 'Innloggingen med Microsoft ble avbrutt.';
export const MICROSOFT_NO_EMAIL_MESSAGE =
  'Microsoft ga ikke fra seg e-postadressen din. Kontakt romsjef eller Data.';
export const MICROSOFT_FAILED_MESSAGE = 'Innlogging med Microsoft feilet. Prøv igjen.';

// Supabase sends the user back with ?error=...&error_description=... (in the query or the hash)
// when a sign-in through Microsoft fails. Returns what to tell the user, or null when the
// address carries no error.
export const getAuthErrorFromUrl = (location: { search: string; hash: string }): string | null => {
  const params = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const read = (key: string) => params.get(key) ?? hashParams.get(key) ?? '';

  const error = read('error');
  if (!error) return null;
  const description = read('error_description');

  if (/banned/i.test(description)) return DEACTIVATED_MESSAGE;
  if (/email/i.test(description) && /provider/i.test(description)) {
    return MICROSOFT_NO_EMAIL_MESSAGE;
  }
  // Our own before-user-created hook words its refusal in Norwegian ("Du er ikke registrert...").
  const ours = getErrorMessage(description, '');
  if (ours) return ours;
  if (error === 'access_denied') return MICROSOFT_CANCELLED_MESSAGE;
  return MICROSOFT_FAILED_MESSAGE;
};
