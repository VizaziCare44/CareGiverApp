# CI Secrets and Keys (DEV-057)

Which secret or key goes where, and what is checked. The repository is **public**, so
nothing in the table below may ever be written in a file in it.

## Where each one lives

| Value | What it is | Where it lives | Never in |
|---|---|---|---|
| Test password (`SEED_TEST_PASSWORD`, `E2E_TEST_PASSWORD`) | The one password the seeded and test-made accounts share | Made up fresh for each run: `npm run e2e:fresh` makes `SEED_TEST_PASSWORD`, `playwright.config.ts` makes `E2E_TEST_PASSWORD`. A developer may set either in their own shell. Not kept anywhere. | The repository, the Vercel project, any hosted project's real accounts |
| Service-role key (`SUPABASE_SERVICE_ROLE_KEY`) | Skips every RLS rule. Used only by tests and the seed to set up data | CI: exported for the job from the temporary local Supabase stack (a fixed, well-known development value; it only opens a database thrown away with the runner). Developers: their own shell or an ignored `.env.local`. For the dev project: the developer's own shell, taken from the Supabase dashboard. | The Next.js client bundle, `NEXT_PUBLIC_*` variables, the Vercel **Production** or **Preview** environment, the repository |
| Anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) | Public by design (RLS is what protects data) | Vercel project (Production and Preview), CI (from the local stack) | Nothing to hide, but keep it to the dev project's (`fzkwbajawfircwfzwbjg`) |
| Supabase URL (`NEXT_PUBLIC_SUPABASE_URL`) | Which project the app talks to | Vercel project, CI (from the local stack) | – |
| `TESTDINO_TOKEN` | Sends test results to TestDino | GitHub repository secret | The repository |
| `VERCEL_DEPLOY_HOOK_URL` | Lets the `deploy-production` job request a deploy after the tests pass | GitHub repository secret | The repository |

The read credential for a second repository in CI is set up under DEV-024, not here (and
`backend-config` is in this public repository, so none is needed today).

## Who sets what up

- **Tech Lead:** the GitHub repository secrets (`TESTDINO_TOKEN`, `VERCEL_DEPLOY_HOOK_URL`) and the
  Vercel project variables. Nobody else needs the service-role key for the dev project.
- **Developers:** their own shell for the service-role key and (optionally) the test password.
- **No one** types a secret into a chat, a ticket, a commit, or a test file.

## What is checked

`tests/e2e/secrets.spec.ts` runs with every CI run:

1. The service-role key is not in the Next.js build output: not in `.next/static` (what the browser
   downloads), and its value is not in `.next/server`. A JWT in the build with the `service_role` claim fails it.
2. No file the repository tracks contains a Supabase JWT with the `service_role` claim, the
   current service-role key value, or a password-shaped assignment to the shared test password.
3. No `NEXT_PUBLIC_*` name in the code or the workflow mentions the service-role key.
4. Environment files (`.env`, `.env.*`) are ignored by git.

**Checked by hand (TC-VER-059), because it is a setting at Vercel and not a file:** in the Vercel
project, Settings → Environment Variables, no variable in Production or Preview holds a
service-role key. Today the Supabase Marketplace integration still injects `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_SECRET_KEY` and `SUPABASE_JWT_SECRET` (for the old VizaziMain project). The app never reads
them, and they are not `NEXT_PUBLIC_*`, so they are not in the bundle, but they must be removed
(disconnect the integration) before this counts as done.

## If a key is exposed

Rotate it in the Supabase dashboard (Settings → API) first, then update the places in the table.
