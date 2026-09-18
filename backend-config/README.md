# Backend Config

Supabase migrations and project config for Vizazi Care, extracted from the
`vizazi-care` app repo per FD-ACC §7.1/§10 (DEV-002) — the app and backend
config are kept as separate concerns even though both currently live under
`VizaziCare44/CareGiverApp`.

- `supabase/config.toml` — Supabase project config
- `supabase/migrations/` — schema migrations, applied in order

Apply locally with `supabase db reset` (or `supabase migration up`) from
this directory after `supabase link`-ing to the target project.
