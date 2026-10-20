import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

export type LoginResult =
  | { success: true; user: User; session: Session }
  | { success: false; error: string };

export async function logIn(email: string, password: string): Promise<LoginResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    // Deactivated users have a banned login (see the delete-user edge function).
    if (error?.message?.toLowerCase().includes('banned')) {
      return { success: false, error: 'Kontoen er deaktivert. Kontakt romsjef eller Data.' };
    }

    if (error || !data.user || !data.session) {
      return {
        success: false,
        error: 'Innlogging feilet: ' + (error?.message ?? 'ukjent feil'),
      };
    }

    return { success: true, user: data.user, session: data.session };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : 'NetworkError when attempting to fetch resource';
    return { success: false, error: 'Innlogging feilet: ' + message };
  }
}

export type LogoutResult = { success: true } | { success: false; error: string };

export async function logOut(): Promise<LogoutResult> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { success: false, error: 'Kunne ikke logge ut: ' + error.message };
    }
    return { success: true };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : 'NetworkError when attempting å kontakte auth-tjenesten';
    return { success: false, error: 'Kunne ikke logge ut: ' + message };
  }
}

export type ForgotPasswordResult = { success: true } | { success: false; error: string };

export async function forgotPassword(email: string): Promise<ForgotPasswordResult> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      return { success: false, error: 'Kunne ikke sende e-post: ' + error.message };
    }
    return { success: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Ukjent feil';
    return { success: false, error: 'Kunne ikke sende e-post: ' + message };
  }
}

export type ResetPasswordResult = { success: true } | { success: false; error: string };

export async function resetPassword(newPassword: string): Promise<ResetPasswordResult> {
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      return { success: false, error: 'Kunne ikke oppdatere passord: ' + error.message };
    }
    return { success: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Ukjent feil';
    return { success: false, error: 'Kunne ikke oppdatere passord: ' + message };
  }
}
