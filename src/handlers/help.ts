import { BotContext } from "../bot";

export default async function help_handler(ctx: BotContext) {
    await ctx.reply(`
This bot forwards messages from one chat to another.
<i><b>from_chat_id</b> is the chat id from which you want to forward messages.
<b>to_chat_id</b> is the chat id to which you want to forward messages.

You can use username instead of id for channels and supergroups only.</i>

<b>Commands:</b>
<pre>
/set (from_chat_id) (to_chat_id)
    Add a chat to the forwarding list.
/rem (from_chat_id) (to_chat_id)
    Remove a chat from the forwarding list.
/get (from_chat_id)
    Get the forwarding list for a chat.
/get
    Get the forwarding list for all chats.
/set_owner (user_id)
    Set the new owner of the bot.
</pre>
<i>Example:</i>
<pre>/set 123456789 987654321</pre>
This will forward all messages from chat 123456789 to chat 987654321.
<pre>/rem 123456789 987654321</pre>
This will remove forwarding from chat 123456789 to chat 987654321.
<pre>/get 123456789</pre>
This will show all chats that are forwarded from chat 123456789.
<pre>/rem 123456789</pre>
This will remove all forwarding from chat 123456789.

<i>To forward messages from one chat to multiple chats repeat the /set command with different to_chat_id.</i>
<pre>/set 123456789 987654321</pre>
<pre>/set 123456789 123456789</pre>

<i>The owner can be changed user by /set_owner (user id) command. This will allow the new user to use the bot commands.</i>

<b>Source:</b> https://github.com/viperadnan-git/telegram-forwarder-bot`);
}
