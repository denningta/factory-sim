# Deploying with Docker Compose

```bash
cp .env.example .env       # first time only; then set real secrets (see below)
set -a; . ./.env; set +a   # load .env into this shell
docker compose up -d     # app + postgres; app on http://localhost:${APP_PORT}
curl "localhost:${APP_PORT:-8080}/health"
```

- Postgres has a healthcheck; the app starts only once it is healthy.
- The app validates its configuration at startup and exits with a message naming each problem if `PORT` is invalid, `DATABASE_URL` is missing, or `SESSION_SECRET` is missing or still the `.env.example` placeholder. Check `docker compose logs app`.
- The app container runs as the unprivileged `node` user.
- Both services use `restart: unless-stopped`, so they come back after a host reboot (Docker daemon must be enabled at boot).
- Data lives in the named volume `pgdata`.
- Upgrade: `git pull && docker compose up -d --build`.

## Database password

The password appears in **both** `POSTGRES_PASSWORD` and inside `DATABASE_URL` (`postgres://USER:PASSWORD@postgres:5432/DB`). Change it in both places, using the same value, before the first `docker compose up`. Postgres only reads `POSTGRES_PASSWORD` when it first creates the volume, so changing it later needs `ALTER USER` inside the database as well. Special characters in the password must be URL-encoded in `DATABASE_URL`.

## Backup and restore

```bash
set -a; . ./.env; set +a
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql
docker compose exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB" < backup.sql   # restore
```

`-T` disables the pseudo-TTY so the dump is not corrupted by terminal line endings; `$POSTGRES_USER` is expanded on the host from your `.env`.

## First sign-in and accounts

- **Complete setup immediately after the first start.** Until the first admin exists, `POST /api/auth/setup` is open to anyone who can reach the app, and whoever calls it first becomes admin. After that it answers 409.
- Admins create and disable users through `/api/users`. Passwords need at least 12 characters and are stored as argon2id hashes.
- Sessions end after `SESSION_IDLE_HOURS` (default 8) without activity and after `SESSION_MAX_DAYS` (default 7) regardless. Disabling a user ends their sessions at once.
- **HTTPS:** behind a TLS-terminating proxy set `COOKIE_SECURE=true` so the session cookie gets the `Secure` flag. Leave it `false` for plain-HTTP local use, or browsers will drop the cookie.
- Failed sign-ins are throttled per email and IP in memory (one app instance); restarting the app resets the counters.
- The OpenAPI description is served at `/api/openapi.json`.
- **Throttle key behind a reverse proxy:** the sign-in throttle is keyed by email and client IP. The app believes `X-Forwarded-For` only from the addresses in `TRUST_PROXY` (comma-separated IPs or CIDRs, e.g. `TRUST_PROXY=172.18.0.1`); by default it trusts nobody, and `COOKIE_SECURE` no longer affects this. Without a trusted proxy all clients behind it share the proxy's IP, so anyone could lock a known user out for up to 15 minutes with bad passwords. The proxy must set the header itself, and the app must not be reachable except through it: change the `app` service's `ports` to `127.0.0.1:${APP_PORT:-8080}:8080` (or put both on the proxy's Docker network) so clients cannot connect directly and spoof the header.
- **Web app:** the image serves the production web build at `/` from the same port as the API, so `http://localhost:${APP_PORT}/` opens the app after `docker compose up -d`. Unknown `/api/*` paths answer JSON 404s, and unknown extension-less paths return `index.html` so client-side routes survive a reload.
