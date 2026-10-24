// Email and password stays available as a fallback while Microsoft sign-in beds in. Set
// VITE_LOCAL_LOGIN_ENABLED=false in the build to hide it (and "glemt passord") for everyone.
export const isLocalLoginEnabled = (value: unknown = import.meta.env.VITE_LOCAL_LOGIN_ENABLED) =>
  String(value ?? '')
    .trim()
    .toLowerCase() !== 'false' && String(value ?? '').trim() !== '0';
