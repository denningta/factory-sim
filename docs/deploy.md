# Deploying with Docker Compose

```bash
cp .env.example .env     # then set real secrets (see below)
docker compose up -d     # app + postgres; app on http://localhost:${APP_PORT}
curl "localhost:${APP_PORT:-8080}/health"   # export APP_PORT first if you changed it in .env
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
