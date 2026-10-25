import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NETWORK_MESSAGE,
  PERMISSION_MESSAGE,
  SESSION_MESSAGE,
  TIMEOUT_MESSAGE,
  getErrorMessage,
  installGlobalErrorHandlers,
  isChunkLoadError,
  reportError,
} from './errors';

const FALLBACK = 'Kunne ikke lagre vakten.';

describe('getErrorMessage', () => {
  it('keeps the Norwegian messages our database functions raise', () => {
    expect(getErrorMessage(new Error('Rommet er fullt'), FALLBACK)).toBe('Rommet er fullt');
    expect(getErrorMessage(new Error('Det er ikke din tur'), FALLBACK)).toBe('Det er ikke din tur');
    expect(getErrorMessage(new Error('Bare romsjef kan tildele rom'), FALLBACK)).toBe(
      'Bare romsjef kan tildele rom'
    );
  });

  it('removes the English prefix a DAO puts in front of such a message', () => {
    expect(
      getErrorMessage(
        new Error('Could not claim shift: Vakten er ikke lenger ledig for bytte'),
        FALLBACK
      )
    ).toBe('Vakten er ikke lenger ledig for bytte');
  });

  it('falls back when the message is technical English', () => {
    expect(
      getErrorMessage(new Error('Could not get rooms: relation "x" does not exist'), FALLBACK)
    ).toBe(FALLBACK);
    expect(getErrorMessage(new Error('JSON object requested, multiple rows'), FALLBACK)).toBe(
      FALLBACK
    );
    expect(getErrorMessage(new Error('nope'), FALLBACK)).toBe(FALLBACK);
  });

  it('explains lost connections', () => {
    expect(getErrorMessage(new TypeError('Failed to fetch'), FALLBACK)).toBe(NETWORK_MESSAGE);
    expect(
      getErrorMessage(new Error('NetworkError when attempting to fetch resource'), FALLBACK)
    ).toBe(NETWORK_MESSAGE);
    expect(getErrorMessage(new Error('Could not get shifts: Load failed'), FALLBACK)).toBe(
      NETWORK_MESSAGE
    );
  });

  it('explains an expired session and missing access', () => {
    expect(getErrorMessage(new Error('JWT expired'), FALLBACK)).toBe(SESSION_MESSAGE);
    expect(
      getErrorMessage(
        new Error('new row violates row-level security policy for table "x"'),
        FALLBACK
      )
    ).toBe(PERMISSION_MESSAGE);
    expect(getErrorMessage(new Error('permission denied for table users'), FALLBACK)).toBe(
      PERMISSION_MESSAGE
    );
  });

  it('explains timeouts and constraint violations', () => {
    expect(
      getErrorMessage(new Error('canceling statement due to statement timeout'), FALLBACK)
    ).toBe(TIMEOUT_MESSAGE);
    expect(
      getErrorMessage(
        new Error('duplicate key value violates unique constraint "rooms_number_key"'),
        FALLBACK
      )
    ).toBe('Dette finnes allerede.');
    expect(
      getErrorMessage(new Error('insert violates foreign key constraint "x_fkey"'), FALLBACK)
    ).toBe('Dette kan ikke gjøres fordi noe annet er knyttet til det.');
  });

  it('copes with errors that are not Error objects', () => {
    expect(getErrorMessage('Rommet er fullt', FALLBACK)).toBe('Rommet er fullt');
    expect(getErrorMessage({ message: 'Failed to fetch' }, FALLBACK)).toBe(NETWORK_MESSAGE);
    expect(getErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(getErrorMessage(null, FALLBACK)).toBe(FALLBACK);
    expect(getErrorMessage({ message: 42 }, FALLBACK)).toBe(FALLBACK);
    expect(getErrorMessage(new Error(''), FALLBACK)).toBe(FALLBACK);
  });
});

describe('isChunkLoadError', () => {
  it('recognises the ways a page can fail to load', () => {
    expect(
      isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /x.js'))
    ).toBe(true);
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Loading chunk 12 failed.'))).toBe(true);
    expect(
      isChunkLoadError(
        new Error('Element type is invalid. Lazy element type must resolve to a class or function.')
      )
    ).toBe(true);
    expect(isChunkLoadError(new Error('Siden kunne ikke lastes'))).toBe(true);
  });

  it('does not mistake other errors for it', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe('reportError and global handlers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs with a context', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('x');

    reportError(error, 'Lagring');

    expect(log).toHaveBeenCalledWith('Lagring:', error);
  });

  it('logs errors and rejections nobody handled, until removed', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const remove = installGlobalErrorHandlers(window);

    const error = new Error('boom');
    window.dispatchEvent(new ErrorEvent('error', { error, message: 'boom' }));
    const rejection = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(rejection, 'reason', { value: 'avvist' });
    window.dispatchEvent(rejection);

    expect(log).toHaveBeenCalledWith('Uhåndtert feil:', error);
    expect(log).toHaveBeenCalledWith('Uhåndtert løfte:', 'avvist');

    remove();
    log.mockClear();
    // Vitest turns an error event nobody is listening for into an uncaught exception, so something
    // else listens while the removed handler is checked.
    const bystander = vi.fn();
    window.addEventListener('error', bystander);
    window.dispatchEvent(new ErrorEvent('error', { error, message: 'boom' }));
    window.removeEventListener('error', bystander);

    expect(bystander).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
  });
});
