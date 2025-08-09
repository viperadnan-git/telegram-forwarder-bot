FROM oven/bun:latest AS builder

WORKDIR /app

COPY package*.json bun.lockb ./

RUN bun install --production

COPY . .

RUN bun run build

FROM oven/bun:latest as runner

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

EXPOSE 3000

CMD [ "bun", "run", "start" ]