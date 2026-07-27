<div align="center">

# telegram-forwarder-bot

Forwards messages from one chat to many, each destination with its own filters and caption rules — configured from a Telegram Mini App.

</div>

<p align="center">
  <a href="https://github.com/viperadnan-git/telegram-forwarder-bot/actions/workflows/docker.yml"><img src="https://img.shields.io/github/actions/workflow/status/viperadnan-git/telegram-forwarder-bot/docker.yml?style=plastic&logo=github&label=build" alt="Build" /></a>
  <a href="https://github.com/viperadnan-git/telegram-forwarder-bot/pkgs/container/telegram-forwarder-bot"><img src="https://img.shields.io/badge/ghcr.io-published-2496ED?style=plastic&logo=docker&logoColor=white" alt="Container image" /></a>
  <a href="https://grammy.dev"><img src="https://img.shields.io/github/package-json/dependency-version/viperadnan-git/telegram-forwarder-bot/grammy?style=plastic&logo=telegram&logoColor=white&label=grammY&color=229ED9" alt="grammY" /></a>
  <a href="https://svelte.dev"><img src="https://img.shields.io/github/package-json/dependency-version/viperadnan-git/telegram-forwarder-bot/dev/svelte?style=plastic&logo=svelte&logoColor=white&label=Svelte&color=FF3E00&filename=web%2Fpackage.json" alt="Svelte" /></a>
  <a href="https://orm.drizzle.team"><img src="https://img.shields.io/github/package-json/dependency-version/viperadnan-git/telegram-forwarder-bot/drizzle-orm?style=plastic&logo=postgresql&logoColor=white&label=Drizzle&color=336791" alt="Drizzle ORM" /></a>
  <a href="https://hub.docker.com/r/viperadnan/telegram-forwarder-bot"><img src="https://img.shields.io/docker/image-size/viperadnan/telegram-forwarder-bot/latest?style=plastic&logo=docker&logoColor=white&label=image%20size&color=2496ED" alt="Image size" /></a>
  <img src="https://img.shields.io/github/repo-size/viperadnan-git/telegram-forwarder-bot?style=plastic&color=E8E2D8" alt="Repo size" />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0--or--later-blue?style=plastic" alt="License" /></a>
</p>

<div align="center">

[Features](#features) · [Commands](#commands) · [Mini App](#mini-app) · [Configuration](#configuration) · [Running](#running) · [Contributing](#contributing)

</div>

---

## Features

- **One source, many destinations.** Each destination is configured independently — its own filters, mode and caption rules.
- **Copy or forward.** Plus protected content, silent delivery and button removal.
- **Filters that compose.** Allow and block lists over keywords, patterns, media type or sender. Blocking always wins.
- **Caption transforms.** Prepend, append, find and replace, strip links or mentions.
- **Formatting survives.** Entity offsets are recomputed around every edit, not dropped.
- **Albums stay albums.** Grouped media arrives grouped, not split into separate messages.
- **Linear-time patterns.** Regex runs on RE2, so a user pattern cannot hang the bot.
- **Native chat picker.** Telegram's own chat list, so there are no ids to type.
- **Self-service cloning.** Paste a BotFather token and you own a copy. Tokens are verified with Telegram and never stored.

---

## Commands

| Command | |
| --- | --- |
| `/set` | Pick source and destination from a list |
| `/set (source) (destination)` | Add a forward without the picker |
| `/rem (source) (destination)` | Remove one destination, or all with `/rem (source)` |
| `/get (source)` | List a source's destinations, or everything with `/get` |
| `/settings` | Open the Mini App |
| `/cancel` | Stop a half-finished `/set` |
| `/set_owner (user_id)` | Transfer ownership |
| `/help` | How it works |

`/set`, `/get` and `/rem` are owner-only.

Anywhere a chat is expected you can pass a chat id, an `@username` or a t.me
link — including a message link, which yields the chat it belongs to. Invite
links carry no id and cannot be used. `/set_owner` takes a numeric user id:
Telegram resolves a `@username` only for public chats, never for a person.

---

## Mini App

Reachable from the chat menu button, `/settings` or `/help`. Requires
`WEBHOOK_HOST`.

- **Status** — pause a destination without deleting it
- **Delivery** — copy or forward, protected, silent, remove buttons
- **Filters** — allow-only and never-forward, each on its own screen
- **Caption** — remove, prepend, append, find and replace, strip links or mentions

Rules are validated as you type, against the same schema the server saves with.
Lookbehind and backreferences are unsupported by RE2 and rejected. Text that is
matched against is trimmed, so an invisible trailing space cannot silently stop
a rule matching. Prepended and appended text keeps its own newlines and goes on
its own line, so a signature needs no blank line typed in front of it.

Only the owner can open it. Everyone else lands on a page where they can paste
their own bot's token — confirmed with `getMe` and shown for approval before
anything is claimed. Pasting the token of a bot already running here hands it
back, which is how you recover a bot whose ownership you lost.

### Open button

Telegram shows an *Open* button for bots with a Main Mini App. No Bot API method
sets it, so each bot's owner does it once in BotFather:

```
/mybots → pick the bot → Bot Settings → Configure Mini App → Enable Mini App
```

Then give it `https://<WEBHOOK_HOST>/app/settings?bot=<bot_id>`. Keep the
`?bot=` — a Main Mini App launched from a profile carries no start parameter,
so the query string is what tells the page which bot it is configuring.

---

## Configuration

Copy [`.env.sample`](./.env.sample) to `.env`.

| Variable | |
| --- | --- |
| `BOT_TOKEN` | **Required.** From [BotFather](https://t.me/BotFather) |
| `DATABASE_URL` | **Required.** PostgreSQL connection string, the source of truth |
| `WEBHOOK_HOST` | **Required.** Public HTTPS URL of this server |
| `REDIS_URI` | Shares the cache between instances and across restarts. One long-running container does not need it — the in-process cache is faster |
| `CACHE_TTL_SECONDS` | Default `3600`. Writes invalidate what they affect, so this only bounds staleness from direct SQL or unshared instances |
| `CACHE_MAX_ENTRIES` | In-process cache cap, default `10000` |
| `DIRECT_DATABASE_URL` | Non-pooled connection for migrations. Set it when `DATABASE_URL` points at a transaction pooler |
| `DATABASE_POOL_MAX` | Default `10` |
| `LOG_LEVEL` | Default `debug`, or `info` when `NODE_ENV=production` |

---

## Running

```sh
bun install
bun run build      # Mini App, then the server bundle
bun start
```

Development: `bun run dev` for the server, `bun run dev:web` for the Mini App,
`bun run verify` for lint, typecheck and tests.

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

---

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
Postgres and deletes nothing:

```sh
REDIS_URI=<old-redis-uri> bun run migrate:redis
```

Chats imported this way have placeholder names until you tap **Refresh chat
names** in the Mini App.

### Upgrading from bot-name modifiers

`~` and `|` in a bot's name used to set protected content and caption stripping
for every route. Those are per-destination settings now, and nothing needs
doing: the first time an upgraded bot handles a message its name is read and the
equivalent settings are written onto routes still using defaults. Routes you
have already configured are untouched, and the characters can be dropped from
the name afterwards.

---

## Contributing

Pull requests welcome. Open an issue first for anything substantial.

## License

GPL-3.0-or-later — see [LICENSE](LICENSE).
