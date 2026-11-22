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
- **Throttle key behind a reverse proxy:** the sign-in throttle is keyed by email and client IP. With `COOKIE_SECURE=true` the app trusts `X-Forwarded-For` (Fastify `trustProxy`) so the key is the real client, so the proxy must set that header itself and the app must not be reachable except through it. Without that, anyone could spoof the header, or (with `COOKIE_SECURE=false` behind a proxy) all clients share the proxy's IP and anyone can lock a known user out for up to 15 minutes with bad passwords.
