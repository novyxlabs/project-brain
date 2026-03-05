---
name: project-brain
description: "AI coding partner's permanent memory — remembers stack decisions, bugs, fixes across sessions"
version: 1.0.0
author: Novyx Labs
repository: https://github.com/novyxlabs/project-brain
entry_point: index.js
category: "Coding Agents & IDEs"
homepage_url: https://github.com/novyxlabs/project-brain
documentation_url: https://github.com/novyxlabs/project-brain#readme
license: MIT
min_novyx_version: 1.0.0
---

# Project Brain

**Your AI coding partner's permanent memory — with time-travel debugging.**

Project Brain remembers your stack decisions, bug fixes, and architecture across sessions. It only saves what's novel (no duplicates). Made a bad decision? `/brain rewind` rolls back. Need proof of what changed? `/brain diff 24h`. Want the full story of a memory? `/brain prove <id>`.

## How It Works

```
You:     We're using Postgres for the database and Supabase for auth.
Agent:   Got it.
         [auto-saved — novel information detected]

You:     What database are we using?
Agent:   You chose Postgres for the database and Supabase for auth.
         [auto-recalled from memory]

You:     /brain diff 24h
Agent:   Memory Diff
         Period: 2026-02-24T12:00:00Z → 2026-02-25T12:00:00Z
         Added (3):
           + Stack decision: Postgres + Supabase
           + Bug fix: auth token expiry was 1h, changed to 24h
           + Deployment: switched from Heroku to Fly

You:     /brain prove abc-123
Agent:   Memory Lifecycle: abc-123
         State: active
         Created: 2026-02-24T14:30:00Z
         Recall Count: 7
         Events:
           2/24, 2:30 PM  create
           2/24, 3:15 PM  recalled
           2/24, 5:00 PM  auto_linked to def-456
```

## Commands

| Command | What it does |
|---------|-------------|
| `/brain status` | Recent project context |
| `/brain stats` | Memory usage and tier info |
| `/brain recall <topic>` | Semantic search for a topic |
| `/brain rewind <time>` | Preview rollback to a point in time (Pro) |
| `/brain rewind confirm` | Execute the pending rollback (Pro) |
| `/brain prove <id>` | Full lifecycle of a memory (Pro) |
| `/brain diff <range>` | What changed in a time range (Pro) |
| `/brain help` | List commands |

### Diff Shortcuts

- `/brain diff 1h` — changes in last hour
- `/brain diff 24h` — changes in last day
- `/brain diff 7d` — changes in last week

## Install

```bash
git clone https://github.com/novyxlabs/project-brain.git extensions/project-brain
cd extensions/project-brain && npm install
```

Create `.env`:
```
NOVYX_API_KEY=your_key_here
```

Get a free API key at [novyxlabs.com](https://novyxlabs.com) (5,000 memories, no credit card).

## What Novyx Features This Uses

- **`POST /v1/memories`** — save project context with novelty detection
- **`GET /v1/memories/search`** — semantic recall
- **`POST /v1/rollback`** — rewind to any point in time (Pro)
- **`GET /v1/replay/memory/{id}`** — full memory lifecycle audit (Pro)
- **`GET /v1/replay/diff`** — memory diff between timestamps (Pro)
- **`GET /v1/usage`** — tier and usage stats

## Auto-Capture

Project Brain uses **semantic novelty detection** instead of keyword matching. When your agent responds, it checks whether similar information already exists in memory. Only genuinely new information gets saved. No duplicates, no noise.

The novelty threshold (default: 0.75 similarity) can be tuned via the `noveltyThreshold` config option.

## License

MIT
