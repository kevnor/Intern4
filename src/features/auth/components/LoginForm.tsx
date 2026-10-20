import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { logIn } from '../../../server/dao/authentication';
import { useAuth } from '../../../app/providers/AuthContext';
import { AUTH_PATHS } from '../paths';
import { APP_ROUTES } from '../../../app/constants/appRoutes';
import { Button, Field, Input, PasswordInput, StatusMessage } from '../../../shared/components';

const LoginForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      navigate(APP_ROUTES.HOME);
    }
  }, [user, navigate]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await logIn(email, password);

    setLoading(false);

    if (!result.success) {
      setError(result.error);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4" noValidate>
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

      <Field label="Passord">
        {(field) => (
          <PasswordInput
            {...field}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
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

      <Button type="submit" size="lg" fullWidth loading={loading} disabled={!email || !password}>
        Logg inn
      </Button>
    </form>
  );
};

export default LoginForm;
