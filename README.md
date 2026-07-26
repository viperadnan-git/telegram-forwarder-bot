# Telgram Message Forwarder Bot

A simple telegram bot to forward messages from one channel to another channel or group. Written in pure Telegram Bot API using grammy framework.
This bot uses webhooks to receive updates from telegram servers. So, you need a server with a public IP address and a domain name to run this bot. This bot can be deployed on serverless platforms like Vercel, Render, Cyclic etc.

## Features

-   Forward messages from one channel to another channel or group
-   Forward messages from multiple channels to multiple channels or groups
-   Forward messages from multiple channels to a single channel or group
-   Forward messages from a single channel to multiple channels or groups
-   Configurations through commands
-   Owner only commands, so no one can misuse the bot
-   Easy to clone and create your own bot withing minutes
-   Control forwarding behavior via bot name (protect content, remove captions)

## Commands

-   `/start` - Start the bot
-   `/help` - Show help message
-   `/set` - Add a channel to forward messages from
-   `/rem` - Remove a channel from forwarding messages
-   `/get` - List all the channels added
-   `/set_owner` - Set the owner of the bot

## Bot Name Modifiers

You can control forwarding behavior by adding special characters to your bot's name (via [BotFather](https://t.me/BotFather)):

-   `~` - Enable protected content (forwarded messages cannot be forwarded further or saved)
-   `|` - Remove captions from forwarded messages

For example, if your bot is named `MyForwarder~`, all forwarded messages will have content protection enabled. You can combine modifiers, e.g., `MyBot~|` for both protected content and no captions.

## Configurations

Configurations are added in environment variables or [`.env.sample`](./.env.sample) file and rename it to `.env`. The following environment variables are required to run the bot.

-   `BOT_TOKEN` - Telegram bot token received from [BotFather](https://t.me/BotFather)
-   `DATABASE_URL` - PostgreSQL connection string. This is the source of truth
-   `WEBHOOK_HOST` - URL of the server where the bot is running

Optional:

-   `REDIS_URI` - Enables a shared cache layer. Only needed for multi-instance or serverless deployments. On a single long-running container the in-process cache is already faster, and leaving this unset is the right choice
-   `CACHE_TTL_SECONDS` - Cache entry lifetime, default `60`
-   `CACHE_MAX_ENTRIES` - In-process cache size cap, default `10000`
-   `DIRECT_DATABASE_URL` - Non-pooled connection string, used for migrations only. Set this when `DATABASE_URL` points at a transaction pooler
-   `DATABASE_POOL_MAX` - Client-side connection pool size, default `10`

### Database setup

Apply migrations before starting the bot. This uses the `drizzle-kit` CLI, which
is a dev dependency, so run it from a checkout with dev dependencies installed —
not from inside the production image:

```sh
bun install
bun run db:migrate
```

After changing `src/db/schema.ts`, regenerate the migration SQL with
`bun run db:generate`, then apply it. `bun run db:studio` opens a browser UI over
the database.

If you are upgrading from a Redis-backed version, backfill your existing data
once (this reads Redis and writes Postgres, and deletes nothing):

```sh
REDIS_URI=<old-redis-uri> bun run migrate:redis
```

## Deploying

### Deploying on Vercel, Render, Cyclic, Heroku etc.

-   Fork this repository
-   Create a new app on the platform you want to deploy
-   Connect your forked repository to the app
-   Set environment variables in the project settings
-   (Optional) Set the `PORT` environment variable to the port number provided by the platform or set it to 3000

### Self-Hosting

Not recommended for beginners.

Note: You need SSL certificates and a public IP address to run the bot. As this bot works on webhooks, you need a domain name to set the webhook URL. You can use [Cloudflare Tunnel](https://try.cloudflare.com/) to get a free temporary domain name and SSL certificates.

#### Using Docker

-   Clone this repository

```sh
git clone <repo-url> <project-name>
cd <project-name>
```

-   Create a `.env` file with your environment variables (see [`.env.sample`](./.env.sample))

-   Run with Docker Compose

```sh
docker-compose up -d
```

Or build and run manually:

```sh
docker build -t telegram-forwarder-bot .
docker run -d --env-file .env -p 3000:3000 telegram-forwarder-bot
```

#### Manual Deployment

-   Clone this repository

```sh
git clone <repo-url> <project-name>
cd <project-name>
```

-   Install dependencies

```sh
bun install
```

-   Build the project

```sh
bun run build
```

-   Set environment variables

-   Start the bot

```sh
bun start
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the GPL-3.0-or-later - see the [LICENSE](LICENSE) file for details
