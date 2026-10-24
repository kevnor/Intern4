import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const stub = (name: string) =>
  fileURLToPath(new URL(`./supabase/functions/_testing/${name}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // The edge functions import from the network (Deno style); in tests those become local stubs.
    alias: {
      'jsr:@supabase/functions-js/edge-runtime.d.ts': stub('edgeRuntimeStub.ts'),
      'https://esm.sh/@supabase/supabase-js@2': stub('supabaseClientStub.ts'),
    },
  },
});
