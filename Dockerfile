FROM oven/bun:latest

WORKDIR /usr/src/app

COPY package*.json ./

RUN bun install

COPY . .

EXPOSE 3000

CMD [ "bun", "run", "bun:start" ]