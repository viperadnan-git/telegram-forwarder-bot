import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { webApp } from "./lib/telegram";

const REPO = "https://github.com/viperadnan-git/telegram-forwarder-bot";

// No signed launch payload means this was not opened from Telegram, so there is
// no bot to configure and every request would 401. Skipped in dev so the app
// can still be previewed in a plain browser.
if (webApp?.initData || import.meta.env.DEV) {
    mount(App, { target: document.getElementById("app")! });
} else {
    location.replace(REPO);
}
