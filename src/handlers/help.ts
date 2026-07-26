import { BotContext, miniAppUrl } from "../bot";

export default async function help_handler(ctx: BotContext) {
    const url = miniAppUrl(ctx.me.id);

    await ctx.reply(
        `
This bot forwards messages from one chat to another.
<i><b>source</b> is the chat messages are forwarded from.
<b>destination</b> is the chat messages are forwarded to.

Each can be a chat id, an @username, or a t.me link.</i>

<b>Per-destination settings</b> — filters, forward mode and caption changes — live in the Settings Mini App, reachable from the menu button below the message box.

<b>Commands:</b>
<pre>
/set
    Pick the source and destination from a list of your chats.
/set (source) (destination)
    Add a destination without the picker.
/rem (source) (destination)
    Remove a destination from the forwarding list.
/get (source)
    Show the destinations for a source chat.
/get
    Show every source chat and its destinations.
/set_owner (user_id)
    Set the new owner of the bot.
</pre>
<i>The quickest way is to send /set on its own and pick the chats from the list Telegram shows you. Only chats I am already in appear there.</i>

<i>Example without the picker:</i>
<pre>/set 123456789 987654321</pre>
Forwards every new message from source 123456789 to destination 987654321.
<pre>/set https://t.me/mychannel @mygroup</pre>
The same, using a link and a username.
<pre>/rem 123456789 987654321</pre>
Removes that one destination.
<pre>/get 123456789</pre>
Shows every destination for that source chat.
<pre>/rem 123456789</pre>
Removes every destination for that source chat.

<i>To forward one source to several destinations, repeat /set with a different destination.</i>
<pre>/set 123456789 987654321</pre>
<pre>/set 123456789 555555555</pre>

<i>The owner can be changed with /set_owner (user id). This lets the new user run the bot commands.</i>

<b>Source:</b> https://github.com/viperadnan-git/telegram-forwarder-bot`,
        url
            ? {
                  reply_markup: {
                      inline_keyboard: [
                          [{ text: "Open settings", web_app: { url } }]
                      ]
                  }
              }
            : undefined
    );
}
