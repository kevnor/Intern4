import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const stub = (name: string) =>
  fileURLToPath(new URL(`./supabase/functions/_testing/${name}`, import.meta.url));

// The edge functions import from the network (Deno style). In tests those imports become local stubs.
// Not `alias` or a resolveId hook: Vite's module runner hands anything with a URL scheme (https:) to
// Node's loader before either is asked. So the two import lines are rewritten as the file is read.
const denoImportStubs: Record<string, string> = {
  'jsr:@supabase/functions-js/edge-runtime.d.ts': stub('edgeRuntimeStub.ts'),
  'https://esm.sh/@supabase/supabase-js@2': stub('supabaseClientStub.ts'),
};

const stubDenoImports = (): Plugin => ({
  name: 'stub-deno-imports',
  enforce: 'pre',
  transform(code, id) {
    const path = id.split('?')[0].replaceAll('\\', '/');
    if (!path.includes('/supabase/functions/') || path.includes('/_testing/')) return null;

    let rewritten = code;
    for (const [specifier, stubPath] of Object.entries(denoImportStubs)) {
      rewritten = rewritten.replaceAll(`'${specifier}'`, `'${stubPath}'`);
    }
    return rewritten === code ? null : { code: rewritten, map: null };
  },
});

export default defineConfig({
  plugins: [react(), stubDenoImports()],
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // The Supabase client refuses to load without these. Placeholders keep the tests independent of
    // anyone's .env.local (and of CI having none); no test talks to a real server.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});
