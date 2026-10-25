# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use **Report a vulnerability** under the
repository's **Security** tab (GitHub private vulnerability reporting), so it reaches the maintainers
without being public.

Include what you found, how to reproduce it, and what it lets someone do. Reports about the residents'
data, sign-in (Microsoft and email/password), roles and the Supabase database rules are the most
valuable.

## Supported versions

Only the latest `main` is supported.

## What is checked automatically

Every pull request and a weekly run go through the checks in
[`.github/workflows/security.yml`](.github/workflows/security.yml): dependency audit, secret scan,
CodeQL and database checks. The README ("Security checks") explains what fails the build and how to run
them locally.
