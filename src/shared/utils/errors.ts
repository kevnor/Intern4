// One place for turning errors into messages people can act on, and for logging the ones nobody
// handled.

const NETWORK_PATTERNS = [
  /failed to fetch/i,
  /networkerror/i,
  /network request failed/i,
  /load failed/i,
  /fetch failed/i,
  /err_internet_disconnected/i,
  /err_network/i,
];

const SESSION_PATTERNS = [/jwt expired/i, /invalid jwt/i, /not authenticated/i, /refresh token/i];

const PERMISSION_PATTERNS = [
  /row-level security/i,
  /permission denied/i,
  /not allowed/i,
  /insufficient[_ ]privilege/i,
];

const CONSTRAINT_MESSAGES: [RegExp, string][] = [
  [/duplicate key value/i, 'Dette finnes allerede.'],
  [/violates foreign key constraint/i, 'Dette kan ikke gjøres fordi noe annet er knyttet til det.'],
  [/violates check constraint/i, 'Verdien er ikke gyldig.'],
  [/violates not-null constraint/i, 'Noe som må fylles ut mangler.'],
];

const TIMEOUT_PATTERNS = [/timeout/i, /timed out/i, /statement timeout/i];

// Our own database functions and DAOs raise Norwegian messages ("Rommet er fullt"), which are the
// ones worth showing as they are. Everything else (SQL, fetch, library errors) is English.
const NORWEGIAN =
  /[æøåÆØÅ]|\b(ikke|er|det|du|kan|bare|må|noen|ingen|fra|til|og|eller|har|som|denne|dette|din|ditt|rom|rommet|vakt|vakten|beboer|beboeren|romslipp|romslippet|oppgave|oppgaven|melding|meldingen)\b/i;

const messageOf = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const { message } = error as { message: unknown };
    return typeof message === 'string' ? message : '';
  }
  return '';
};

// "Could not claim shift: Vakten er ikke lenger ledig" -> "Vakten er ikke lenger ledig".
const stripDaoPrefix = (message: string): string =>
  message.replace(/^Could not [a-z ]+?: /i, '').trim();

export const NETWORK_MESSAGE = 'Ingen kontakt med serveren. Sjekk nettverket og prøv igjen.';
export const SESSION_MESSAGE = 'Økten din har utløpt. Logg inn på nytt.';
export const PERMISSION_MESSAGE = 'Du har ikke tilgang til å gjøre dette.';
export const TIMEOUT_MESSAGE = 'Det tok for lang tid. Prøv igjen om litt.';

// A message for the screen. `fallback` is what to say when the error is technical and says
// nothing a resident could use, so it should describe what failed ("Kunne ikke lagre vakten.").
export const getErrorMessage = (error: unknown, fallback: string): string => {
  const raw = messageOf(error);
  if (!raw) return fallback;
  const message = stripDaoPrefix(raw);

  if (NETWORK_PATTERNS.some((pattern) => pattern.test(message))) return NETWORK_MESSAGE;
  if (SESSION_PATTERNS.some((pattern) => pattern.test(message))) return SESSION_MESSAGE;
  if (PERMISSION_PATTERNS.some((pattern) => pattern.test(message))) return PERMISSION_MESSAGE;
  if (TIMEOUT_PATTERNS.some((pattern) => pattern.test(message))) return TIMEOUT_MESSAGE;
  const constraint = CONSTRAINT_MESSAGES.find(([pattern]) => pattern.test(message));
  if (constraint) return constraint[1];

  return NORWEGIAN.test(message) ? message : fallback;
};

// The page's code could not be loaded: an old tab after a new version was deployed, a flaky
// network, or a dev server that hot-reloaded a lazy page.
export const isChunkLoadError = (error: unknown): boolean => {
  const message = messageOf(error);
  return (
    /dynamically imported module/i.test(message) ||
    /importing a module script failed/i.test(message) ||
    /loading (css )?chunk/i.test(message) ||
    /lazy element type must resolve/i.test(message) ||
    /siden kunne ikke lastes/i.test(message)
  );
};

// Everything nobody caught ends up here. Logging is all it does today; a monitoring service would
// be plugged in here.
export const reportError = (error: unknown, context?: string): void => {
  console.error(context ? `${context}:` : 'Uventet feil:', error);
};

export const installGlobalErrorHandlers = (target: Window = window): (() => void) => {
  const onError = (event: ErrorEvent) =>
    reportError(event.error ?? event.message, 'Uhåndtert feil');
  const onRejection = (event: PromiseRejectionEvent) =>
    reportError(event.reason, 'Uhåndtert løfte');
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
};
