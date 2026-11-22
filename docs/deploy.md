# Deploying with Docker Compose

```bash
cp .env.example .env     # then set real secrets
docker compose up -d     # app + postgres; app on http://localhost:${APP_PORT}
curl localhost:8080/health
```

- Postgres has a healthcheck; the app starts only once it is healthy.
- Both services use `restart: unless-stopped`, so they come back after a host reboot (Docker daemon must be enabled at boot).
- Data lives in the named volume `pgdata`. Back up with `docker compose exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB`.
- Upgrade: `git pull && docker compose up -d --build`.
