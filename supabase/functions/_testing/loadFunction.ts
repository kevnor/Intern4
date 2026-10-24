import { vi } from 'vitest';
import type { FakeSupabase } from './fakeSupabase';

// Loads an edge function with the pieces only Deno has replaced: Deno.serve hands the handler to the
// test, Deno.env has fixed values, and the Supabase client comes from the fake (the network imports
// are aliased to stubs in vite.config.ts).
export async function loadFunction(
  importFunction: () => Promise<unknown>,
  getFake: () => FakeSupabase
): Promise<(request: Request) => Promise<Response>> {
  let handler: ((request: Request) => Promise<Response>) | undefined;

  // Fresh modules, so the stub and the function share one instance of each other.
  vi.resetModules();
  vi.stubGlobal('Deno', {
    serve: (serve: (request: Request) => Promise<Response>) => {
      handler = serve;
    },
    env: {
      get: (name: string) =>
        ({
          SUPABASE_URL: 'http://localhost',
          SUPABASE_ANON_KEY: 'anon-key',
          SUPABASE_SERVICE_ROLE_KEY: 'service-key',
        })[name],
    },
  });

  const stub = await import('./supabaseClientStub');
  stub.useFake(getFake);
  await importFunction();
  if (!handler) throw new Error('The function did not register a handler');
  return handler;
}

export const post = (body: unknown) =>
  new Request('http://localhost/fn', {
    method: 'POST',
    headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
