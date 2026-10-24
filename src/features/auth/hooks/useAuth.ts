import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../../server/supabaseClient';
import { clearSignedUrlCache } from '../../../server/storage';
import { DEACTIVATED_MESSAGE, NO_PROFILE_MESSAGE } from '../authErrors';

export type AuthUser = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  // How the person can sign in: 'email' (a password) and/or 'azure' (Microsoft).
  providers?: string[];
} | null;

export type UseAuthReturn = {
  user: AuthUser;
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
  clearError: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
};

type UserProfileRow = {
  name: string | null;
  email: string | null;
  is_active: boolean | null;
  roles?: { name: string | null } | Array<{ name: string | null }> | null;
};

const getRoleName = (profile: UserProfileRow | null | undefined): string | undefined => {
  if (!profile?.roles) return undefined;
  if (Array.isArray(profile.roles)) return profile.roles[0]?.name ?? undefined;
  return profile.roles.name ?? undefined;
};

export const useProvideAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const setBasicUser = (id: string, email?: string | null, providers?: string[]) => {
      setUser({
        id,
        email: email ?? undefined,
        providers,
      });
    };

    // A login without an active profile (a Microsoft account Romsjef has not added, or a
    // deactivated resident) must not get into the app: sign out and say why on the login page.
    // Signing out is deferred because the auth client must not be called from inside its own
    // state-change callback.
    const refuse = (message: string) => {
      setError(message);
      setUser(null);
      clearSignedUrlCache();
      setTimeout(() => void supabase.auth.signOut(), 0);
    };

    const loadProfile = async (id: string, email?: string | null, providers?: string[]) => {
      const { data, error: profileError } = await supabase
        .from('users')
        .select('name, email, is_active, roles(name)')
        .eq('id', id)
        .maybeSingle();

      if (!isMounted) return;

      if (profileError) {
        setError('Kunne ikke laste brukerprofil');
        setBasicUser(id, email, providers);
        return;
      }

      const profile = data as UserProfileRow | null;
      if (!profile) return refuse(NO_PROFILE_MESSAGE);
      if (profile.is_active === false) return refuse(DEACTIVATED_MESSAGE);

      setError(null);
      setUser({
        id,
        name: profile.name ?? undefined,
        email: profile.email ?? email ?? undefined,
        role: getRoleName(profile),
        providers,
      });
    };

    const providersOf = (sessionUser: User): string[] | undefined =>
      sessionUser.identities?.map((identity) => identity.provider) ??
      sessionUser.app_metadata?.providers;

    const loadInitialSession = async () => {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (!session?.user) {
        clearSignedUrlCache();
        setUser(null);
        setLoading(false);
        return;
      }

      await loadProfile(session.user.id, session.user.email, providersOf(session.user));
      setLoading(false);
    };

    void loadInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        clearSignedUrlCache();
        setUser(null);
        setLoading(false);
        return;
      }

      const providers = providersOf(session.user);
      loadProfile(session.user.id, session.user.email, providers)
        .catch(() => {
          if (!isMounted) return;
          setError('Kunne ikke laste brukerprofil');
          setBasicUser(session.user.id, session.user.email, providers);
        })
        // A first Microsoft sign-in finishes here, not in loadInitialSession.
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    setError(null);
    const { error } = await supabase.auth.signOut();
    if (error) setError(error.message);
  };

  return {
    user,
    loading,
    error,
    logout,
    clearError: () => setError(null),
    isAuthenticated: !!user,
    isAdmin: user?.role === 'Data' || user?.role === 'Daglig leder',
  };
};
