# Pinned: "latest" makes builds unreproducible and can break without a commit.
FROM oven/bun:1.3.14 AS builder

WORKDIR /app

# Manifests before sources, so dependency layers survive source-only changes.
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

COPY web/package.json web/bun.lock ./web/
RUN cd web && bun install --frozen-lockfile

COPY . .

# Builds the Mini App into web/dist, then bundles the server.
RUN bun run build

FROM oven/bun:1.3.14-slim AS runner

WORKDIR /app

# Without this the logger falls back to debug and logs every request.
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
# Served at /app by Express; index.ts resolves it relative to dist/.
COPY --from=builder /app/web/dist ./web/dist

USER bun

EXPOSE 3000

CMD [ "bun", "run", "start" ]
