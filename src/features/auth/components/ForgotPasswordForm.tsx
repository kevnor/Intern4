import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../../../server/dao/authentication';
import { AUTH_PATHS } from '../paths';
import { Button, Field, Input, StatusMessage } from '../../../shared/components';

const COOLDOWN_SECONDS = 60;

const ForgotPasswordForm = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);
      setLoading(true);

      const result = await forgotPassword(email);

      setLoading(false);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSent(true);
      setCountdown(COOLDOWN_SECONDS);
    },
    [email]
  );

  const handleResend = async () => {
    setError(null);
    setLoading(true);

    const result = await forgotPassword(email);

    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setCountdown(COOLDOWN_SECONDS);
  };

  if (sent) {
    return (
      <div className="space-y-4">
        <StatusMessage tone="success">
          Hvis det finnes en konto med denne e-postadressen, vil du motta en e-post med en lenke for
          å tilbakestille passordet ditt.
        </StatusMessage>

        {error && <StatusMessage tone="error">{error}</StatusMessage>}

        <div className="flex items-center justify-between gap-3">
          <Link to={AUTH_PATHS.LOGIN} className="text-sm font-medium text-primary hover:underline">
            Tilbake til innlogging
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResend}
            disabled={countdown > 0}
            loading={loading}
          >
            {countdown > 0 ? `Send på nytt (${countdown}s)` : 'Send på nytt'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <StatusMessage tone="error">{error}</StatusMessage>}

      <Field label="E-post">
        {(field) => (
          <Input
            {...field}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            placeholder="navn@eksempel.no"
          />
        )}
      </Field>

      <Button type="submit" size="lg" fullWidth loading={loading} disabled={!email}>
        Send tilbakestillingslenke
      </Button>

      <div className="text-center">
        <Link to={AUTH_PATHS.LOGIN} className="text-sm font-medium text-primary hover:underline">
          Tilbake til innlogging
        </Link>
      </div>
    </form>
  );
};

export default ForgotPasswordForm;
