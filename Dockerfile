FROM oven/bun:latest

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./

RUN bun install

COPY . .

EXPOSE 3000

CMD [ "bun", "run", "bun:start" ]