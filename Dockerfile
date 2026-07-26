FROM oven/bun:latest AS builder

WORKDIR /app

COPY package*.json bun.lockb ./

RUN bun install --production

COPY . .

# Builds the Mini App into web/dist, then bundles the server.
RUN bun run build

FROM oven/bun:latest AS runner

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
# Served at /app by Express; index.ts resolves it relative to dist/.
COPY --from=builder /app/web/dist ./web/dist

EXPOSE 3000

CMD [ "bun", "run", "start" ]
