# Singsaker Studenterhjem – Internsiden

The internal website for Singsaker Studenterhjem: regi (work hours), tasks, residents and user
administration.

**Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Supabase (Postgres, Auth, Storage, Edge
Functions) and Vitest with Testing Library.

## Getting started

### Prerequisites

- Node.js 22.12 or newer (Node 20 is end of life, and the test runner needs 22.12). `.nvmrc` has the version CI uses.
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
  add `http://localhost:54321/auth/v1/callback` (Entra rejects `127.0.0.1`; `localhost` is allowed over http).
- **Certificates & secrets:** create a client secret and copy its _value_.
- **Token configuration → Add optional claim → ID token:** add `email` and `xms_edov`. Without
  `xms_edov` Supabase does not treat the Microsoft email as verified, and will not link the sign-in to
  the resident's existing account.
- Note the **Application (client) ID** and **Directory (tenant) ID**.

### 2. Configure Supabase

On a hosted project: **Authentication → Providers → Azure**: enable it and enter the client ID, the
secret and the tenant URL `https://login.microsoftonline.com/<tenant-id>` (nothing after the tenant
ID: Supabase adds the rest). Then
**Authentication → Hooks → Before User Created**: choose the Postgres function
`public.hook_before_user_created` (created by migration `20261024100000_add_auth_gate.sql`). It only
lets an account be created for someone with an active profile and the same email. Add your production
site URL under **Authentication → URL Configuration**.

Locally, put the values in `supabase/.env` (gitignored):

```sh
SUPABASE_AUTH_EXTERNAL_AZURE_CLIENT_ID=<client id>
SUPABASE_AUTH_EXTERNAL_AZURE_SECRET=<client secret>
SUPABASE_AUTH_EXTERNAL_AZURE_URL=https://login.microsoftonline.com/<tenant-id>
```

set `enabled = true` under `[auth.external.azure]` (and `[auth.hook.before_user_created]`) in
`supabase/config.toml`, and restart `npx supabase start`. **Do not commit those two changes**: the
committed default is `false`, because `supabase start` fails when Azure is on without credentials and
the hook blocks adding users in Studio. With the hook on, create a test resident
with the app's "Ny bruker" form (or the mock scripts), not with Studio's _Add user_, because the
profile must exist before the login is created.

### Switching off email and password

Email and password is a fallback while Microsoft sign-in beds in. Set `VITE_LOCAL_LOGIN_ENABLED=false`
when building the app (in `.env.local` locally, or as a build variable where it is deployed) to hide
the email form and "Glemt passord?", leaving only "Logg inn med Microsoft". It only hides the form: the
residents' passwords still exist until the login policy changes.

### Adding a resident

Romsjef (or Data, Admin) adds the resident with **Ny bruker**, using the email of their
Microsoft account. The dialog that follows gives a ready-made welcome message with the login link, to
paste into mail or chat. While email and password is on, it also shows the temporary password, once;
with `VITE_LOCAL_LOGIN_ENABLED=false` there is no password to hand over. The first Microsoft sign-in
is linked to the profile by email.

### What happens at sign-in

- A resident Romsjef has added signs in with Microsoft; their Microsoft account is matched by email.
- Someone else is refused with "Du er ikke registrert som beboer".
- A deactivated resident is refused on both ways in ("Kontoen er deaktivert"): deactivating bans the
  login, and the app also checks `is_active` after every sign-in.
- People who sign in only with Microsoft see a note instead of the password form under Profil → Passord.

## Scripts

| Command                  | What it does                                       |
| ------------------------ | -------------------------------------------------- |
| `npm run dev`            | Starts the Vite dev server with hot reload.        |
| `npm test`               | Runs the Vitest suite once.                        |
| `npm run lint`           | Runs ESLint, including Prettier and hook rules.    |
| `npm run format`         | Formats the codebase with Prettier.                |
| `npm run format:check`   | Checks formatting without changing files.          |
| `npm run build`          | Builds the production bundle into `dist/`.         |
| `npm run preview`        | Serves the production build locally.               |
| `npm run security:audit` | Audits production dependencies (fails on high).    |
| `npm run security:db`    | Checks the local database schema (needs Supabase). |

CI (`.github/workflows/ci.yml`) runs `format:check`, `lint`, `test` and `build` on every push and
pull request. Run them before pushing.

## Admin page

**Admin** in the menu is for Data and Admin (the route is guarded the same way, so other roles get
"Ingen tilgang"). It has four tabs:

- **Oversikt:** what needs a look, each number linking to where it is dealt with: active residents, on
  leave, without a room, planned move-outs, free places, open room reports and regi waiting for
  approval. A number that cannot be read shows a dash instead of breaking the page.
- **Utflyttinger:** planned move-outs in one list (with **Avbryt utflytting**), and a feed of who added,
  moved out and reactivated residents.
- **Roller:** who holds each position role (Admin, Data, Romsjef, Regisjef, Vaktsjef, Daglig leder,
  Utvalgsmedlem). A role nobody holds shows "Ingen". Change a role on the person's profile.
- **Semester:** the required hours for this semester. Admin and Data can set them (the same card is
  under Regi, Status).

## Security checks

[`.github/workflows/security.yml`](.github/workflows/security.yml) runs on every pull request, on pushes
to `main`, every Monday and on demand. **High and critical findings fail the run**; anything lower is
reported in the job summary.

| Job              | What it checks                                                                                                                                       | Run it locally                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Dependency audit | `npm audit` on production dependencies fails on high or critical. All dependencies are listed in the summary, report only (dev tooling never ships). | `npm run security:audit`               |
| Secret scan      | gitleaks over the pull request's commits (the whole history on `main` and the weekly run), with [`.gitleaks.toml`](.gitleaks.toml).                  | `gitleaks git --config .gitleaks.toml` |
| Code analysis    | CodeQL (`security-extended`) on the app and the edge functions. Results are under **Security → Code scanning**.                                      | CI only                                |
| Database checks  | Starts local Supabase (applying every migration), then [`scripts/db-security-check.sql`](scripts/db-security-check.sql) and `supabase db lint`.      | `npm run security:db`                  |

The database check fails on: a table in `public` without row level security, a `SECURITY DEFINER`
function without a fixed `search_path` or callable by `anon`, any `anon` privilege on a table in
`public`, a view that bypasses row level security, and a public storage bucket. To accept a finding on
purpose, add it to the allowlist at the top of the script, with the reason next to it. The same goes
for `.gitleaks.toml`: it allows only this project's two public anon keys, so any other JWT (a
`service_role` key, say) fails.

Dependabot proposes npm and GitHub Actions updates weekly (`.github/dependabot.yml`). Actions are
pinned by commit SHA; Dependabot keeps the SHAs current. Changes to migrations, edge functions, scripts
and `.github/` need review from the owner (`.github/CODEOWNERS`). How to report a vulnerability is in
[`SECURITY.md`](SECURITY.md).

### Turn these on in GitHub (settings, not files)

- **Settings → Branches → rule for `main`:** require a pull request, require the status checks
  `Dependency audit`, `Secret scan`, `Code analysis (CodeQL)`, `Database checks` and the `checks` job
  of CI, require review from code owners, and do not allow direct pushes.
- **Settings → Code security:** enable private vulnerability reporting (what `SECURITY.md` points to),
  secret scanning with push protection, and Dependabot alerts.

### What this does not cover

- The checks look at the schema the migrations build, not the hosted project's dashboard settings: the
  Azure provider, the before-user-created hook, password rules and MFA. Check those by hand after a
  deploy.
- Security headers and a Content-Security-Policy are not set anywhere yet, because it is undecided
  where the front end is served from. They belong in that host's configuration once it is chosen.
- The edge functions import `@supabase/supabase-js` from `esm.sh` at the floating major version `@2`.
  Pinning an exact version would stop an upstream change from reaching production unreviewed.
- Dev-only advisories in `vite`, `vitest` and their dependencies (esbuild, tinypool) need major
  upgrades (vite 5 → 8, vitest 1 → 5). They affect the dev server and test runner, not the shipped
  bundle.

## Project structure

```
src/
  app/        App shell: routing, navigation, providers (auth, theme), layout, landing page
  features/   Product domains: regi, tasks, residents, users, auth, ...
  server/     Supabase access (DAOs, storage, mappers)
  shared/     Reusable UI components, layouts, types and utilities
supabase/
  migrations/ Database schema and RLS policies
  functions/  Edge functions (create-user, delete-user, reactivate-user) and shared role rules
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

- **create-user** refuses an email that is already in use (any case), saves the profile first and then
  creates the login with the same id, and takes the profile back if the login fails. It logs `added`.
- **delete-user** (move out now) checks who is asking and then calls the database function
  `offboard_user_internal`; see "Moving residents out" below.
- **reactivate-user** lifts the ban and logs `reactivated`. A login that an older deactivation deleted
  is recreated with the same id, and a new temporary password is returned to hand over.

### Moving residents out

`offboard_user_internal` does the whole move-out in one transaction, for both "Flytt ut nå" and a
planned date: future Vakt shifts become open gaps (and open swaps are cancelled), the person is skipped
in a running romslipp, a position role (Daglig leder, Data, Regisjef, Romsjef, Utvalgsmedlem, Vaktsjef)
is reset to Halv/Halv, the room is freed, the login is banned (the resident cannot sign in again, with
a password or through Microsoft, until reactivated) and a `moved_out` line is written to
`resident_events`. An Admin cannot be moved out, and only Admin and Data move out (or add, or
reactivate) someone who holds a management role (`can_manage_role` in the database, `canManageRole` in
the functions).

A planned date (`users.move_out_date`) is picked up by the `offboard-due-users` job, which `pg_cron`
runs every hour; the date is checked by the Oslo clock. On a hosted project `pg_cron` is enabled by the
migration. It runs as the database owner, so check `select * from cron.job_run_details order by
start_time desc limit 5;` after the first planned move-out.

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
