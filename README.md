# Singsaker Studenterhjem – Internsiden

The internal website for Singsaker Studenterhjem: regi (work hours), tasks, residents and user
administration.

**Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Supabase (Postgres, Auth, Storage, Edge
Functions) and Vitest with Testing Library.

## Getting started

### Prerequisites

- Node.js 20, the version CI uses.
- Docker, for running Supabase locally.

### 1. Install dependencies

```sh
npm ci
```

### 2. Start Supabase locally

```sh
npx supabase start
```

The first run applies every migration in `supabase/migrations`. When it finishes it prints the
API URL and the anon (publishable) key. `npx supabase status` shows them again later.

If `supabase start` stops with `Error status 502`, see [Troubleshooting](#troubleshooting).

### 3. Configure environment variables

Create `.env.local` in the repo root. It is gitignored, like all `.env*` files.

```sh
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from supabase start>
# Optional, defaults to "Bilder":
# VITE_SUPABASE_IMAGES_BUCKET=Bilder
```

To work against a hosted project instead, use its URL and anon key from the Supabase dashboard
(Project Settings → API). Everything you do there changes real data.

### 4. Seed the local database

The migrations create the tables, but no roles, storage bucket or users.

1. Open Studio at <http://127.0.0.1:54323>.
2. Create a login under **Authentication → Add user**, with "Auto confirm" ticked.
3. Run this in the SQL editor, replacing the email:

```sql
insert into public.roles (name) values
  ('Admin'), ('Data'), ('Regisjef'), ('Romsjef'), ('Full Regi'),
  ('Full Vakt'), ('Halv/Halv'), ('Utvalgsmedlem'), ('Daglig leder');

insert into storage.buckets (id, name, public) values ('Bilder', 'Bilder', false);

insert into public.users (id, email, name, role_id, is_active, on_leave)
select id, email, 'Admin', (select id from public.roles where name = 'Admin'), true, false
from auth.users where email = 'you@example.com';
```

`npx supabase db reset` wipes local data and re-runs the migrations. Seed again after a reset.

#### Optional: mock data

To try Vakt, Regi and Rom with realistic data, load the mock residents, schedule, tasks, rooms and
hours. **Local database only, never a hosted project.** Seed the roles and your own Admin login
first (above), then:

```sh
DB=$(docker ps --format '{{.Names}}' | grep supabase_db)
docker exec -i $DB psql -U postgres < supabase/mock/vakt-mock-data.sql
docker exec -i $DB psql -U postgres < supabase/mock/regi-mock-data.sql
docker exec -i $DB psql -U postgres < supabase/mock/rooms-mock-data.sql
# Optional: start a romslipp with the first residents already answered.
docker exec -i $DB psql -U postgres < supabase/mock/romslipp-mock-round.sql
```

This adds 70 residents (`mock01@mock.test` to `mock70@mock.test`, password `mock1234`; `mock01` is
the Vaktsjef, `mock69` the Regisjef and `mock70` the Romsjef), a published vakt schedule with swaps,
regi tasks and hours in every state, and room types, shared rooms, room history, former residents,
problem reports and work on rooms. A few shifts and regi entries go to your Admin login. Run the
scripts in the order above. They can be re-run: they remove the earlier mock data and recreate it.
Room types stay set afterwards. A romslipp that is running blocks assigning rooms by hand, so cancel
it from Rom → Romslipp when you want to use Administrer.

### 5. Run the app

```sh
npm run dev
```

Open <http://localhost:5173> and log in. Emails sent locally, such as password resets, show up in
Mailpit at <http://127.0.0.1:54324>.

## Sign in with Microsoft (Entra ID)

Residents sign in with their Microsoft account; email and password stays as a fallback. Only people
Romsjef has already added can get in: the Microsoft account is matched to the resident by **email**
(case does not matter), and anyone else is refused. Roles are still set in the app, not in Entra.

### 1. Register the app in Entra

In the Entra admin centre go to **App registrations → New registration**:

- **Supported account types:** this organisation only (single tenant).
- **Redirect URI (Web):** `https://<project-ref>.supabase.co/auth/v1/callback`. For local testing also
  add `http://127.0.0.1:54321/auth/v1/callback`.
- **Certificates & secrets:** create a client secret and copy its _value_.
- **Token configuration → Add optional claim → ID token:** add `email` and `xms_edov`. Without
  `xms_edov` Supabase does not treat the Microsoft email as verified, and will not link the sign-in to
  the resident's existing account.
- Note the **Application (client) ID** and **Directory (tenant) ID**.

### 2. Configure Supabase

On a hosted project: **Authentication → Providers → Azure**: enable it and enter the client ID, the
secret and the tenant URL `https://login.microsoftonline.com/<tenant-id>/v2.0`. Then
**Authentication → Hooks → Before User Created**: choose the Postgres function
`public.hook_before_user_created` (created by migration `20261024100000_add_auth_gate.sql`). It only
lets an account be created for someone with an active profile and the same email. Add your production
site URL under **Authentication → URL Configuration**.

Locally, put the values in `supabase/.env` (gitignored):

```sh
SUPABASE_AUTH_EXTERNAL_AZURE_CLIENT_ID=<client id>
SUPABASE_AUTH_EXTERNAL_AZURE_SECRET=<client secret>
SUPABASE_AUTH_EXTERNAL_AZURE_URL=https://login.microsoftonline.com/<tenant-id>/v2.0
```

set `enabled = true` under `[auth.external.azure]` (and `[auth.hook.before_user_created]`) in
`supabase/config.toml`, and restart `npx supabase start`. With the hook on, create a test resident
with the app's "Ny bruker" form (or the mock scripts), not with Studio's _Add user_, because the
profile must exist before the login is created.

## Scripts

| Command                | What it does                                    |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Starts the Vite dev server with hot reload.     |
| `npm test`             | Runs the Vitest suite once.                     |
| `npm run lint`         | Runs ESLint, including Prettier and hook rules. |
| `npm run format`       | Formats the codebase with Prettier.             |
| `npm run format:check` | Checks formatting without changing files.       |
| `npm run build`        | Builds the production bundle into `dist/`.      |
| `npm run preview`      | Serves the production build locally.            |

CI (`.github/workflows/ci.yml`) runs `format:check`, `lint`, `test` and `build` on every push and
pull request. Run them before pushing.

## Project structure

```
src/
  app/        App shell: routing, navigation, providers (auth, theme), layout, landing page
  features/   Product domains: regi, tasks, residents, users, auth, ...
  server/     Supabase access (DAOs, storage, mappers)
  shared/     Reusable UI components, layouts, types and utilities
supabase/
  migrations/ Database schema and RLS policies
  functions/  Edge functions (create-user, delete-user) and shared role rules
```

Features are organized by business domain, not by role. See
[`docs/feature-structure.md`](docs/feature-structure.md) for the feature contract and how to add a
new feature.

## UI conventions

### Colours and dark mode

All colours are semantic tokens defined in `src/index.css`. Use the token utilities, not raw
Tailwind palette classes, so every screen works in both light and dark mode:

| Use for            | Utilities                                                                             |
| ------------------ | ------------------------------------------------------------------------------------- |
| Page and cards     | `bg-canvas`, `bg-surface`, `bg-surface-muted`, `bg-surface-raised`                    |
| Text               | `text-fg`, `text-muted`, `text-subtle`                                                |
| Borders and inputs | `border-border`, `border-border-strong`, `border-input`                               |
| Brand and actions  | `bg-primary`, `text-primary-fg`, `bg-primary-subtle`, `text-primary`                  |
| Status             | `*-success`, `*-warning`, `*-danger`, `*-info` (each with `-subtle` and `-subtle-fg`) |

- **Theme:** `ThemeProvider` (`src/app/providers/ThemeProvider.tsx`) sets `data-theme` on `<html>`.
  Users choose Lys, Mørk or System in the user menu, the mobile Meny or Profil → Utseende.
- **No flash on load:** an inline script in `index.html` applies the saved theme before first paint.
- **Charts:** recharts needs concrete colours, so use `useChartColors()`.
- **Contrast:** every text and fill pair in both themes meets WCAG AA. Check new tokens before adding them.

### Shared components

Build on `src/shared/components` instead of hand-rolling UI:

- **Actions and feedback:** `Button` (or `buttonClasses()` for links), `Badge` and the status
  badges, `StatusMessage`, `EmptyState`, `Spinner` and `Skeleton`.
- **Forms:** `Field` with `Input`, `Select`, `Textarea`, `Checkbox` and `PasswordInput`, plus
  `SearchInput` and `SegmentedControl`. `Field` links the label, hint and error to the control,
  which keeps forms accessible and lets tests use `getByLabelText`.
- **Dialogs:** `Modal` handles focus trapping, Escape and scroll lock, and modals can be nested.
  Pass `fullScreenOnMobile` for forms and detail views. Use `ConfirmDialog` instead of
  `window.confirm`.
- **Lists:** `DataTable` with `renderCard` shows cards on phones and a table from `md` up.
  Pass `bareCards` when the card renders its own buttons.
- **Layout:** `Card`, `StatTile` and `SectionTabs`.

### Mobile

- **Navigation:** phones get a bottom tab bar (`src/app/layout/MobileTabBar.tsx`) and a Meny
  sheet that lists every page the user's role allows.
- **Tap targets:** keep them at least 44px. The shared buttons do this on touch devices.
- **No sideways scrolling:** pages must not scroll horizontally at 390px width. In grids, use
  `grid-cols-1` (not a bare `grid`) at the base breakpoint, so a wide child such as a table can't
  stretch the layout.

## Database and edge functions

### Migrations

The repo tracks the remote Supabase schema as a pulled baseline in
`supabase/migrations/20260504193842_remote_schema.sql`, plus later project migrations. The
study/school lookup migration is guarded around `public.users` so the Supabase CLI can replay
migrations while creating a shadow database during `db pull`.

For schema changes, add a new migration with `npx supabase migration new <name>`. Don't edit the
pulled baseline, and don't run destructive SQL against production data. To apply pending
migrations locally without wiping data:

```sh
npx supabase migration up --local
```

### Edge functions

`create-user`, `delete-user` and `reactivate-user` in `supabase/functions` add, deactivate and
reactivate residents with the service role. Their role rules live in
`supabase/functions/_shared/userManagement.ts`. Keep it in sync with `roomManagementRoles` in
`src/features/users/permissions.ts`.

- **create-user** saves the profile first and then creates the login with the same id, and takes the
  profile back if the login fails.
- **delete-user** (deactivate) bans the login and sets `is_active = false`. The login is not deleted,
  so the resident cannot sign in again, with a password or through Microsoft, until reactivated.
- **reactivate-user** lifts the ban. A login that an older deactivation deleted is recreated with the
  same id, and a new temporary password is returned to hand over.

The functions are tested with an in-memory stand-in for Supabase (`supabase/functions/_testing`),
so `npm test` covers their logic without Deno or a network.

```sh
npx supabase functions serve   # run locally (needs the edge runtime, see Troubleshooting)
```

### Deploying

Merging to `main` does not change the database. Deploy migrations and functions explicitly,
on staging first if you can:

```sh
npx supabase link --project-ref <project-ref>
npx supabase db push
npx supabase functions deploy create-user delete-user reactivate-user
```

## Troubleshooting

**`npm ci` fails in the `supabase` postinstall (timeout downloading from GitHub).**
The Supabase CLI downloads its binary through npm's `https-proxy` setting. Behind a corporate
proxy, make sure that setting includes the port. For example, in `~/.npmrc`:

```
https-proxy=http://proxy.example.com:8080/
proxy=http://proxy.example.com:8080/
```

**`npx supabase start` fails with `Error status 502`.**
The edge-runtime container couldn't download its Deno dependencies. This usually happens behind a
proxy that inspects TLS, or on a VPN with a small MTU. Start without it:

```sh
npx supabase start -x edge-runtime
```

Everything except the edge functions (creating and deactivating users) works. To run the
functions, start Supabase off the VPN or proxy.

**Tables or columns are missing locally, such as `performed_at`.**
An interrupted first `supabase start` can leave the database with only some migrations applied.
Run `npx supabase migration up --local`.

**Password reset links point at the wrong page locally.**
`site_url` and `additional_redirect_urls` in `supabase/config.toml` must match the dev server
(`http://localhost:5173`). Restart Supabase (`npx supabase stop`, then start it again) after
changing `config.toml`.
