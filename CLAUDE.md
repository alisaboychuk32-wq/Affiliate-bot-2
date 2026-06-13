# CLAUDE.md

Guidance for AI assistants (Claude Code) working in this repository.

## Project overview

A Telegram affiliate-marketing bot (Russian-language) for `@Imalisa_boychuk` / channel `@kanalKursov7`. Built with Node.js and Telegraf. It funnels users through a subscription gate, promotes affiliate offers (САЛИД / ИнфоХит), runs warmup drip campaigns, sells Premium access (Telegram Stars / ЮMoney), accepts ad orders for the channel, offers an AI assistant (Groq), and auto-generates SEO content for Яндекс Дзен / Яндекс Q.

Entry point: `bot.js` (run via `npm start` → `node bot.js`).

## Architecture

Each module is a plain class instantiated once in `bot.js` and wired together manually — there is no DI framework or routing layer beyond Telegraf's `bot.action`/`bot.command`/`bot.on` handlers.

- **`bot.js`** — Telegraf bot setup, all command/action/text handlers, session middleware, AI usage rate-limiting, and the `main()` bootstrap (inits all modules, starts schedulers, launches polling).
- **`database.js`** — `Database` class wrapping `node-json-db`. Stores users, events, errors, referrals in `data/bot.json`. Tracks warmup state, stats, referrals, event logging.
- **`funnel.js`** — `Funnel` class: all user-facing menu/offer screens (subscription gate, welcome menu, free courses, САЛИД/ИнфоХит offer lists, offer detail, funnel steps, warmup messages). Contains the hardcoded `OFFERS` and `WARMUP_MESSAGES` data.
- **`admin.js`** — `Admin` class: `/admin` dashboard, stats screens, user lists, broadcast, error log — all rendered as Telegram messages with inline keyboards.
- **`payments.js`** — `PaymentsManager`: Telegram Stars invoices + ЮMoney payment links, premium activation/expiry, product catalog (`PRODUCTS`), payment records in `data/payments.json`.
- **`payments_backup.js`** — an alternate/older version of `PaymentsManager` that also supports ЮKassa. **Not imported anywhere** — appears to be a backup/reference file, not live code. Confirm with the user before relying on or deleting it.
- **`ads_manager.js`** — `AdsManager`: channel ad order workflow (price list, create/approve/reject/publish orders) stored in `data/ads.json`.
- **`offers_updater.js`** — `OffersUpdater`: maintains the offer catalog in `data/offers.json`, rotates in new weekly offers (`WEEKLY_NEW_OFFERS`), notifies admins.
- **`ai_assistant.js`** — `AIAssistant`: Groq-backed chat assistant (`llama-3.1-8b-instant`), per-user conversation history, keyword-based action suggestions (e.g. suggest an offer based on the question).
- **`content_generator.js`** — `ContentGenerator`: Groq-backed generator for Яндекс Дзен articles and Яндекс Q answers, sent to admins on a schedule or on demand.
- **`scheduler.js`** — `Scheduler`: time-based jobs — channel auto-posts every 12h, daily tip post at 09:00, weekly broadcast Sundays at 10:00.

### Data storage

All persistent state is JSON files under `data/` (created at runtime, not committed), managed via `node-json-db`:
- `data/bot.json` — users, events, errors, referrals (`database.js`)
- `data/payments.json` — payments, premium users, pending ЮMoney (`payments.js`)
- `data/ads.json` — ad orders (`ads_manager.js`)
- `data/offers.json` — offer catalog (`offers_updater.js`)

There is no real database — all reads/writes go through `JsonDB`. Be careful with concurrent writes to the same JSON path (e.g. increment patterns read-then-write).

### In-memory state (lost on restart)

- `sessions` in `bot.js` — per-user session object (ad order flow, AI mode, broadcast prompts).
- `aiUsage` in `bot.js` — daily free AI question counter per user.
- `histories` in `ai_assistant.js` — per-user AI conversation history.

## Conventions

- **CommonJS** modules (`require`/`module.exports`), no build step, no TypeScript.
- Each manager class exposes an `async init()` called from `bot.js`'s `main()` before `bot.launch()`.
- User-facing strings are Russian, often Markdown-formatted, with emoji. Keep this style and language for any new UI text.
- Inline keyboards built with `Markup.inlineKeyboard`; callback data follows patterns like `offer_<id>`, `pay_stars_<productId>`, `admin_<section>`, `ad_approve_<id>` — match existing regex handlers (`bot.action(/^prefix_(.+)$/)`) when adding new ones.
- Admin-only actions always check `ADMIN_IDS.includes(ctx.from.id)` first and `answerCbQuery('⛔')` if unauthorized — follow this pattern for any new admin handler.
- Errors are generally swallowed with `catch (e) {}`/`catch {}` to keep the bot resilient to Telegram API failures (e.g. blocked users). Preserve this defensive style in handlers that loop over many users.
- Offer/product/price data is defined as hardcoded JS objects near the top of the relevant file (`funnel.js` `OFFERS`, `payments.js` `PRODUCTS`, `ads_manager.js` `AD_PRICES`, `offers_updater.js` `DEFAULT_OFFERS`/`WEEKLY_NEW_OFFERS`). Affiliate URLs are placeholders (`https://salid.ru/?w=973405`, `https://ihclick.ru/?idp=326805&link=/`) — don't assume they're final.

## Environment variables

Loaded via `dotenv` (`.env` file, not committed):
- `BOT_TOKEN` — required, Telegram bot token
- `ADMIN_IDS` — comma-separated Telegram user IDs with admin access
- `GROQ_API_KEY` — enables AI assistant + content generator (optional, features degrade gracefully if unset)
- `YMONEY_WALLET` / `YMONEY_SECRET` — enables ЮMoney payment links (optional)

`CHANNEL` (`@kanalKursov7`) is hardcoded in `bot.js` and `scheduler.js`.

## Development workflow

- Install deps: `npm install`
- Run: `npm start` (requires `BOT_TOKEN` in environment/`.env`)
- No test suite currently exists, despite the CI workflow (`.github/workflows/npm-publish.yml`) running `npm test` on release — there's no `test` script in `package.json`, so this would fail if a release were created.
- No linter/formatter is configured.

## Things to watch for

- Several scheduled jobs use `setInterval` polling every minute and check `now.getHours()/getMinutes()/getDay()` — they assume the process stays running continuously and the server clock is in the relevant timezone (display strings use `Europe/Moscow`, but schedule checks use local server time).
- `payments_backup.js` duplicates `payments.js` with ЮKassa support — likely intentional reference for a future feature, not dead code to merge automatically.
