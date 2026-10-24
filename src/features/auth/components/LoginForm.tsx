import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { logIn, signInWithMicrosoft } from '../../../server/dao/authentication';
import { useAuth } from '../../../app/providers/AuthContext';
import { AUTH_PATHS } from '../paths';
import { getAuthErrorFromUrl } from '../authErrors';
import { isLocalLoginEnabled } from '../config';
import MicrosoftSignInButton from './MicrosoftSignInButton';
import { APP_ROUTES } from '../../../app/constants/appRoutes';
import { Button, Field, Input, PasswordInput, StatusMessage } from '../../../shared/components';

const LoginForm = () => {
  const navigate = useNavigate();
  const { user, error: authError, clearError } = useAuth();
  const localLogin = isLocalLoginEnabled();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [microsoftLoading, setMicrosoftLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A failed Microsoft sign-in comes back as ?error=... on this page.
  const [urlError] = useState(() => getAuthErrorFromUrl(window.location));

  useEffect(() => {
    if (user) {
      navigate(APP_ROUTES.HOME);
    }
  }, [user, navigate]);

  // Read once; the address is cleaned so a reload doesn't show the same error again.
  useEffect(() => {
    if (urlError) window.history.replaceState(null, '', window.location.pathname);
  }, [urlError]);

  const busy = loading || microsoftLoading;

  const handleMicrosoft = async () => {
    setError(null);
    clearError?.();
    setMicrosoftLoading(true);

    const result = await signInWithMicrosoft();

    // On success the browser is already on its way to Microsoft.
    if (!result.success) {
      setError(result.error);
      setMicrosoftLoading(false);
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    clearError?.();
    setLoading(true);

    const result = await logIn(email, password);

    setLoading(false);

    if (!result.success) {
      setError(result.error);
    }
  };

  const shownError = error ?? urlError ?? authError;

  return (
    <div className="space-y-5">
      {shownError && <StatusMessage tone="error">{shownError}</StatusMessage>}

      <MicrosoftSignInButton
        onClick={() => void handleMicrosoft()}
        loading={microsoftLoading}
        disabled={busy}
      />

      {localLogin && (
        <>
          <div
            role="separator"
            aria-label="eller"
            className="flex items-center gap-3 text-xs uppercase tracking-wide text-subtle"
          >
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
            eller
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            <Field label="E-post">
              {(field) => (
                <Input
                  {...field}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                  placeholder="navn@eksempel.no"
                />
              )}
            </Field>

            <Field label="Passord">
              {(field) => (
                <PasswordInput
                  {...field}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
              )}
            </Field>

            <div className="text-right">
              <Link
                to={AUTH_PATHS.FORGOT_PASSWORD}
                className="text-sm font-medium text-primary hover:underline"
              >
                Glemt passord?
              </Link>
            </div>

            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={loading}
              disabled={!email || !password || microsoftLoading}
            >
              Logg inn
            </Button>
          </form>
        </>
      )}
    </div>
  );
};

export default LoginForm;
