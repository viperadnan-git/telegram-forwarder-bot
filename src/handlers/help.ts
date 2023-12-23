import { BotContext } from "../bot";

export default async function help_handler(ctx: BotContext) {
    await ctx.reply(`
<b>Commands:</b>
<pre>
/add (from chat_id) (to chat_id)
    Add a chat to the forwarding list.
/rem (from chat_id) (to chat_id)
    Remove a chat from the forwarding list.
/get (from chat_id)
    Get the forwarding list for a chat.
/get
    Get the forwarding list for all chats.
/set_owner
    Set the owner of the bot.
</pre>

<b>Notes:</b>
- The owner is the only one who can use above commands.
- The owner can change user by /set_owner (user id). This will allow the new user to use the bot commands.
- The owner can be set by replying to a message from the owner with /set_owner.
<b>Source:</b>

https://github.com/viperadnan-git/telegram-forwarder-bot
    `);
}
