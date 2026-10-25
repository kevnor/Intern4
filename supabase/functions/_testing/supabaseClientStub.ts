import type { FakeSupabase } from './fakeSupabase';

// Stands in for `https://esm.sh/@supabase/supabase-js@2` when a function is run in a test.
let current: (() => FakeSupabase) | undefined;

export const useFake = (getFake: () => FakeSupabase) => {
  current = getFake;
};

export const createClient = (_url: string, key: string) => {
  if (!current) throw new Error('No fake Supabase has been set up for this test');
  return current().clientFor(key);
};
