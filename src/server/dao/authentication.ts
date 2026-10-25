import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { DEACTIVATED_MESSAGE, MICROSOFT_FAILED_MESSAGE } from '../../features/auth/authErrors';
import { AUTH_PATHS } from '../../features/auth/paths';
import { getErrorMessage } from '../../shared/utils/errors';

export type LoginResult =
  | { success: true; user: User; session: Session }
  | { success: false; error: string };

export async function logIn(email: string, password: string): Promise<LoginResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    // Deactivated users have a banned login (see the delete-user edge function).
    if (error?.message?.toLowerCase().includes('banned')) {
      return { success: false, error: DEACTIVATED_MESSAGE };
    }

    if (error?.message?.toLowerCase().includes('invalid login credentials')) {
      return { success: false, error: 'Feil e-post eller passord.' };
    }

    if (error || !data.user || !data.session) {
      return {
        success: false,
        error: 'Innlogging feilet: ' + getErrorMessage(error, 'ukjent feil'),
      };
    }

    return { success: true, user: data.user, session: data.session };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : 'NetworkError when attempting to fetch resource';
    return { success: false, error: 'Innlogging feilet: ' + message };
  }
}

export type MicrosoftLoginResult = { success: true } | { success: false; error: string };

// Sends the browser to Microsoft and back to the login page, where the session (or an error in the
// address) is picked up. Only residents Romsjef has added get in: that is decided on the server.
export async function signInWithMicrosoft(): Promise<MicrosoftLoginResult> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${window.location.origin}${AUTH_PATHS.LOGIN}`,
        scopes: 'email',
      },
    });
    if (error) {
      return { success: false, error: getErrorMessage(error, MICROSOFT_FAILED_MESSAGE) };
    }
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: getErrorMessage(e, MICROSOFT_FAILED_MESSAGE) };
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
