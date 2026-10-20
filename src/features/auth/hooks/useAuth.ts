import { useEffect, useState } from 'react';
import { supabase } from '../../../server/supabaseClient';
import { clearSignedUrlCache } from '../../../server/storage';

export type AuthUser = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
} | null;

export type UseAuthReturn = {
  user: AuthUser;
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
};

type UserProfileRow = {
  name: string | null;
  email: string | null;
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

    const setBasicUser = (id: string, email?: string | null) => {
      setUser({
        id,
        email: email ?? undefined,
      });
    };

    const loadProfile = async (id: string, email?: string | null) => {
      const { data, error: profileError } = await supabase
        .from('users')
        .select('name, email, roles(name)')
        .eq('id', id)
        .maybeSingle();

      if (!isMounted) return;

      if (profileError) {
        setError('Kunne ikke laste brukerprofil');
        setBasicUser(id, email);
        return;
      }

      const profile = data as UserProfileRow | null;
      setUser({
        id,
        name: profile?.name ?? undefined,
        email: profile?.email ?? email ?? undefined,
        role: getRoleName(profile),
      });
    };

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

      await loadProfile(session.user.id, session.user.email);
      setLoading(false);
    };

    void loadInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      loadProfile(session.user.id, session.user.email).catch(() => {
        if (!isMounted) return;
        setError('Kunne ikke laste brukerprofil');
        setBasicUser(session.user.id, session.user.email);
      });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) setError(error.message);
  };

  return {
    user,
    loading,
    error,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'Data' || user?.role === 'Daglig leder',
  };
};
