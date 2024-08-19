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

## Commands

-   `/start` - Start the bot
-   `/help` - Show help message
-   `/set` - Add a channel to forward messages from
-   `/rem` - Remove a channel from forwarding messages
-   `/get` - List all the channels added
-   `/set_owner` - Set the owner of the bot

## Configurations

Configurations are added in environment variables or [`.env.sample`](./.env.sample) file and rename it to `.env`. The following environment variables are required to run the bot.

-   `BOT_TOKEN` - Telegram bot token received from [BotFather](https://t.me/BotFather)
-   `REDIS_URI` - Redis database URI to store the channel ids. You can use [Redis Labs](https://redislabs.com/) to get a free Redis database
-   `WEBHOOK_HOST` - URL of the server where the bot is running

## Deploying

### Deploying on Vercel, Render, Cyclic, Heroku etc.

-   Fork this repository
-   Create a new app on the platform you want to deploy
-   Connect your forked repository to the app
-   Set environment variables in the project settings
-   (Optional) Set the `PORT` environment variable to the port number provided by the platform or set it to 3000

### Deploy on VPS or any other server

Not recommended for beginners.

Note: You need a SSL certificates and a public IP address to run the bot on a VPS. As this bot work on webhooks, you need a domain name to set the webhook URL. You can use [Cloudflare Tunnel](https://try.cloudflare.com/) to get a free domain name and SSL certificates.

-   Clone this repository

```sh
git clone <repo-url> <project-name>
cd <project-name>
```

-   Install dependencies

```sh
npm install
```

-   Build the project

```sh
npm run build
```

-   Set environment variables

-   Start the bot

```sh
npm start
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the GPL-3.0-or-later - see the [LICENSE](LICENSE) file for details
