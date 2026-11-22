FROM node:22-alpine
RUN corepack enable
WORKDIR /app
# Manifests first so the dependency layer is cached across source changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/schema/package.json packages/schema/
COPY packages/sim-engine/package.json packages/sim-engine/
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY apps apps
COPY packages packages
# Run unprivileged; node_modules stays root-owned and read-only to the app.
USER node
ENV PORT=8080
EXPOSE 8080
# Call tsx directly: pnpm via corepack would download itself at runtime as the non-root user.
WORKDIR /app/apps/api
CMD ["./node_modules/.bin/tsx", "src/main.ts"]
