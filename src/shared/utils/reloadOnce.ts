const KEY = 'app:last-forced-reload';
const WINDOW_MS = 15_000;

// Reloads the page to pick up a fresh copy of the app, but never twice in a row: if the reload did
// not help, the caller shows the error instead of looping. Returns true when it reloaded.
export const reloadOnce = (now: number = Date.now()): boolean => {
  try {
    const last = Number(window.sessionStorage.getItem(KEY));
    if (last && now - last < WINDOW_MS) return false;
    window.sessionStorage.setItem(KEY, String(now));
  } catch {
    // Storage can be blocked. Without it a reload could loop, so don't.
    return false;
  }
  window.location.reload();
  return true;
};
