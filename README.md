# Quest Tracker

A gamified daily & weekly **quest** (task) tracker — a web app + installable PWA
port of the [Pink Propeller QuestMain.ino](https://github.com/Pink-Propeller/Quest)
ESP32 device firmware. It keeps the firmware's mechanics (quest pool, active
limits, Todo → Active → Done/Abandoned flow, timed quests, progress bars,
daily/weekly resets, Discord reports) but runs as a synced web app you can
install on Android via "Add to Home Screen".

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** for styling
- **Prisma 6** ORM + **PostgreSQL** (via Docker) for shared, synced storage
- **SWR** polling so every device sees the same quests in near real-time
- **PWA**: web manifest + service worker (installable, opens offline)

## Prerequisites

- Node.js 20+ and npm
- Docker (for the PostgreSQL database)

## Getting started

```bash
# 1. Start PostgreSQL (defined in docker-compose.yml)
docker compose up -d

# 2. Install dependencies
npm install

# 3. Apply the database schema
npx prisma migrate dev

# 4. Run the dev server
npm run dev
```

Open http://localhost:3000. To use it from your phone on the same network,
open `http://<your-computer-ip>:3000` and use the browser's
**Add to Home Screen** option to install it as an app.

For a production build:

```bash
npm run build
npm start
```

## How it works

Quests are **Daily** or **Weekly**. There are two views:

- **Pool** — your full backlog. Every new quest is added here (queued), never
  straight onto the active board.
- **Quests** — the current run: the quests drawn from the pool for this
  day/week.

Each type has an **active limit** (default 5 daily / 15 weekly — configurable in
Settings). A **run** (the 🎲 Draw button, or the daily/weekly reset) sends a
scope back to Todo and **randomly draws** up to the limit from the pool to fill
the active board — a "random quest of the day" mechanic. You can also manually
**Activate** a specific pooled quest into a free slot, or send an active one back
to the pool.

A quest moves `Todo → Active → Done` (or `Abandoned/Skipped`). Starting a quest
stamps a start time; quests with a duration show a **live countdown** and flag
**OVERDUE** when time runs out.

### XP & levels

Completing a quest awards random **XP** — **10–25** for a daily, **50–120** for a
weekly. XP accumulates into an exponential **level** curve: clearing level *L*
costs `100 × 1.5^(L-1)` XP (100, 150, 225, 338, …), so early levels come fast
and later ones are a satisfying grind. Your level, XP bar, and total are shown at
the top; completing quests pops an XP / level-up toast.

Anti-farming rules:

- XP is rolled **once** per completion and stored on the quest.
- **Reopen** cleanly refunds that quest's XP (a true undo).
- A **reset** keeps your earned XP but clears each quest's award, so recurring
  quests pay out again next cycle.

Tuning lives in [`src/lib/xp.ts`](src/lib/xp.ts) (`XP_RANGES`, `LEVEL_BASE`,
`LEVEL_GROWTH`).

### Settings

- **Discord webhook** — paste a webhook URL to post quest reports.
- **Active limits** — daily / weekly active caps.
- **Reset daily / weekly** — manual resets.

## API

| Method | Route                | Body                                   | Purpose                       |
| ------ | -------------------- | -------------------------------------- | ----------------------------- |
| GET    | `/api/state`         | —                                      | Full state (quests + settings)|
| POST   | `/api/quests`        | `{ name, type, durationMin }`          | Add a quest                   |
| PATCH  | `/api/quests/:id`    | `{ action }`                           | start/complete/abandon/reopen/promote/demote |
| DELETE | `/api/quests/:id`    | —                                      | Delete a quest                |
| POST   | `/api/reset`         | `{ scope: "DAILY"\|"WEEKLY" }`         | Reset a scope                 |
| GET/PATCH | `/api/settings`   | `Partial<Settings>`                    | Read / update settings        |
| POST   | `/api/discord`       | `{ includeWeekly? }`                   | Post a report now             |
| POST   | `/api/cron`          | `{ task: "hourly"\|"eod" }`            | Automation hook (see below)   |

## Docker image

The app ships as a self-contained production image (Next.js standalone output).
On startup it runs `prisma migrate deploy` against `DATABASE_URL`, then serves on
port 3000.

Build and run it yourself:

```bash
# Build
docker build -t quest-tracker .

# Run (point at any reachable Postgres)
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/questtracker?schema=public" \
  quest-tracker
```

Or run the whole stack (database + app) with Compose:

```bash
docker compose --profile app up -d --build
```

Runtime environment variables:

| Variable          | Default | Purpose                                            |
| ----------------- | ------- | -------------------------------------------------- |
| `DATABASE_URL`    | —       | Postgres connection string (required)              |
| `RUN_MIGRATIONS`  | `true`  | Set `false` to skip `migrate deploy` on startup    |
| `PORT`            | `3000`  | Port the server listens on                         |

### CI: build & publish the image

[`.github/workflows/docker.yml`](.github/workflows/docker.yml) runs on your
**self-hosted Linux runner** on every push to `main`, building the image and
pushing it to the GitHub Container Registry as
`ghcr.io/<owner>/<repo>:latest` (and a `sha-<commit>` tag). It uses the built-in
`GITHUB_TOKEN`, so no extra secrets are needed — the runner only needs Docker
installed. There's also [`build.yml`](.github/workflows/build.yml) which lints,
type-checks and builds the app without producing an image.

## Automating Discord reports

The firmware posts an hourly report and a full end-of-day report (plus reset) at
23:59. Reproduce that with any scheduler hitting `/api/cron`.

Optionally set `CRON_SECRET` in `.env`; then send
`Authorization: Bearer <secret>` with each cron request.

**Linux/macOS (crontab):**

```cron
# Hourly report
0 * * * *   curl -s -X POST http://localhost:3000/api/cron -H "Content-Type: application/json" -d '{"task":"hourly"}'
# End-of-day report + reset (weekly report/reset auto-applies on Sundays)
59 23 * * * curl -s -X POST http://localhost:3000/api/cron -H "Content-Type: application/json" -d '{"task":"eod"}'
```

**Windows (Task Scheduler):** create a task running
`curl.exe -X POST http://localhost:3000/api/cron -H "Content-Type: application/json" -d "{\"task\":\"eod\"}"`
on your chosen trigger.

## Differences from the firmware

The hardware-only pieces are intentionally dropped: the TFT display rendering,
battery gauge, physical buttons, sparkle screensaver, and the device's
"Gamify"/"Like & Subscribe" display pages. The web app keeps and improves the
data model: configurable limits, a manual pool promote/demote, reopen, live
timers, and a **random draw** from the pool on reset (the firmware refilled by
creation order).

## Project layout

```
docker-compose.yml      PostgreSQL service
prisma/schema.prisma    Quest + Settings models
scripts/gen-icons.mjs   Regenerate PWA icons
src/lib/                prisma client, domain logic, types, client API
src/app/api/            route handlers (state, quests, reset, settings, discord, cron)
src/app/                layout, manifest, main page
src/components/         UI: QuestCard, AddQuestForm, SettingsPanel, ProgressBar, Countdown
public/sw.js            service worker
```
