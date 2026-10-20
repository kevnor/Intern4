import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../../server/supabaseClient';
import { resetPassword } from '../../../server/dao/authentication';
import { AUTH_PATHS } from '../paths';
import { APP_ROUTES } from '../../../app/constants/appRoutes';
import { useAuth } from '../../../app/providers/AuthContext';
import { Button, Field, PasswordInput, Spinner, StatusMessage } from '../../../shared/components';

const ResetPasswordForm = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState(true);

  useEffect(() => {
    const handleTokenExchange = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setError('Kunne ikke verifisere lenken: ' + error.message);
        }
        setExchanging(false);
        return;
      }

      const hash = window.location.hash;
      if (hash && hash.includes('type=recovery')) {
        setExchanging(false);
        return;
      }

      setExchanging(false);
    };

    void handleTokenExchange();
  }, []);

  const sessionReady = !authLoading && !!user;
  const stillLoading = exchanging || authLoading;

  if (stillLoading) {
    return (
      <p className="flex items-center gap-2 text-muted">
        <Spinner label="Verifiserer lenke..." />
        Verifiserer lenke...
      </p>
    );
  }

  if (!sessionReady) {
    return (
      <div className="space-y-4">
        <StatusMessage tone="error">
          {error || 'Lenken er ugyldig eller utløpt. Be om en ny tilbakestillingslenke.'}
        </StatusMessage>
        <Link
          to={AUTH_PATHS.FORGOT_PASSWORD}
          className="text-sm font-medium text-primary hover:underline"
        >
          Be om ny lenke
        </Link>
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Passordet må være minst 6 tegn.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passordene stemmer ikke overens.');
      return;
    }

    setLoading(true);

    const result = await resetPassword(password);

    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    navigate(APP_ROUTES.HOME);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <StatusMessage tone="error">{error}</StatusMessage>}

      <Field label="Nytt passord" hint="Minst 6 tegn.">
        {(field) => (
          <PasswordInput
            {...field}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        )}
      </Field>

      <Field label="Bekreft passord">
        {(field) => (
          <PasswordInput
            {...field}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          />
        )}
      </Field>

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={loading}
        disabled={!password || !confirmPassword}
      >
        Oppdater passord
      </Button>
    </form>
  );
};

export default ResetPasswordForm;
