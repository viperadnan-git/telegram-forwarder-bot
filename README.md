# Telegram Message Forwarder Bot

Forwards messages from one chat to many, each destination with its own filters
and caption rules. Built on the Telegram Bot API with
[grammY](https://grammy.dev), backed by PostgreSQL, configured from a Telegram
Mini App.

Anyone can clone it: forward a BotFather token to the bot and you get your own
copy, with you as its owner.

## Features

- One source chat to many destinations, each configured independently
- Copy or forward mode, protected content, silent delivery, button removal
- Allow and block filters on keywords, regex, media type or sender
- Caption transforms: prepend, append, find and replace, strip links or mentions
- Formatting survives transforms — entity offsets are recomputed, not dropped
- Albums arrive as albums instead of being split into separate messages
- Native chat picker, so there are no ids to type
- Per-destination pause, without deleting the route

## Commands

| Command | |
| --- | --- |
| `/set` | Pick source and destination from a list |
| `/set (source) (destination)` | Add a route without the picker |
| `/rem (source) (destination)` | Remove one destination, or all with `/rem (source)` |
| `/get (source)` | List a source's destinations, or everything with `/get` |
| `/set_owner (user_id)` | Transfer ownership |
| `/help` | Usage, and a link to the settings app |

Anywhere a chat is expected you can pass a chat id, an `@username`, or a t.me
link. Message links work — the chat is taken from the link. Private links of the
form `t.me/c/<id>/<message>` carry the id directly. Invite links cannot be used
because they contain no id.

## Settings Mini App

Per-destination settings live in a Mini App, reachable from the chat menu button
or `/help`. It needs `WEBHOOK_HOST` set.

- **Status** — pause or resume a destination
- **Delivery** — copy or forward, protected content, silent, remove buttons
- **Filters** — allow-only and never-forward lists. Blocking wins; an empty
  allow list allows everything
- **Caption** — remove, prepend, append, find and replace, strip links or
  mentions

Regex runs on RE2, so a pattern cannot hang the bot. Lookbehind and
backreferences are unsupported and rejected when you save.

Only the owner can open it; everyone else gets instructions for cloning.

## Configuration

Copy [`.env.sample`](./.env.sample) to `.env`.

Required:

- `BOT_TOKEN` — from [BotFather](https://t.me/BotFather)
- `DATABASE_URL` — PostgreSQL connection string, the source of truth
- `WEBHOOK_HOST` — public HTTPS URL of this server

Optional:

- `REDIS_URI` — shares the cache between instances and across restarts. A single
  long-running container does not need it; the in-process cache is faster
- `CACHE_TTL_SECONDS` — default `3600`. Writes invalidate the entries they
  affect, so this only bounds staleness from direct SQL, or between instances
  with no shared Redis
- `CACHE_MAX_ENTRIES` — in-process cache cap, default `10000`
- `DIRECT_DATABASE_URL` — non-pooled connection, migrations only. Set it when
  `DATABASE_URL` points at a transaction pooler
- `DATABASE_POOL_MAX` — default `10`
- `LOG_LEVEL` — default `debug`, or `info` when `NODE_ENV=production`

## Database

Migrations use the `drizzle-kit` CLI, a dev dependency, so run them from a
checkout rather than the production image:

```sh
bun install
bun run db:migrate
```

After editing `src/db/schema.ts`, regenerate with `bun run db:generate` and
apply. `bun run db:studio` opens a browser UI over the database.

Upgrading from a Redis-backed version? Backfill once — it reads Redis, writes
Postgres, and deletes nothing:

```sh
REDIS_URI=<old-redis-uri> bun run migrate:redis
```

Chats imported this way have placeholder names until you tap **Refresh chat
names** in the Mini App.

## Running

```sh
bun install
bun run build      # Mini App, then the server bundle
bun start
```

For development: `bun run dev` for the server, `bun run dev:web` for the Mini
App, `bun test` for the suite.

### Docker

```sh
docker build -t telegram-forwarder-bot .
docker run -d --env-file .env -p 3000:3000 telegram-forwarder-bot
```

### Behind a tunnel

The webhook needs a public HTTPS URL.
[Cloudflare Tunnel](https://try.cloudflare.com/) gives you one:

```sh
cloudflared tunnel --url http://localhost:3000
```

Set `WEBHOOK_HOST` to the URL it prints.

## Upgrading from bot-name modifiers

`~` and `|` in a bot's name used to set protected content and caption stripping
for every route. Those are per-destination settings now, and nothing needs
doing: the first time an upgraded bot handles a message its name is read and the
equivalent settings are written onto routes still using defaults. Routes you
have already configured are untouched, and the characters can be dropped from
the name afterwards.

## Pinned dependencies

Two packages are deliberately held back:

- **`@grammyjs/parse-mode` v1** — v2 dropped `parseMode`/`ParseModeFlavor` and
  became a formatting-string library. The bot sets HTML parse mode globally via
  the v1 transformer.
- **`typescript` v6 in `web/`** — `svelte-check` crashes on v7
  (`typescript.default.sys` is undefined). The server is on v7.

## Contributing

Pull requests welcome. Open an issue first for anything substantial.

## License

GPL-3.0-or-later — see [LICENSE](LICENSE).
