# makefun-frontend

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/tssohag/makefun-frontend/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/tssohag/makefun-frontend/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

A fast, dependency-free make.fun frontend: plain static files in `app/` (vanilla ES modules and one stylesheet, no build step) that read make.fun's public API.

- **Bounty board** (`#/`): every bounty still taking entries (by deadline, not status alone) with its live pot, entry fee, ticking countdown, deadline and entry count; category filters and sorts (ending soon, biggest pot, fewest entries) kept in the URL; live totals and the top builders.
- **Bounty page** (`#/bounty/<slug>`): summary, description, rules, the rewards table with each place's live fee share, opening and closing dates, status and entry fee.
- **Leaderboard** (`#/bounty/<slug>/leaderboard`): one request for the whole board, 50 rows a page, handle search, scores with their intervals and validity.
- **Profile** (`#/u/<handle>`) and **top builders** (`#/builders`): avatar, bio, links, record, entries with placings and paid winnings.

Speed and restraint: the first load is `index.html`, `style.css`, `app.js` and `api.js` (about 9 KB gzipped); the bounty, leaderboard and profile views are loaded on first visit with `import()`. `api.js` keeps answers in an in-memory cache with a TTL, shares requests already in flight and revalidates by ETag. Countdowns tick by rewriting text nodes, and a 60-second live refresh patches the view on screen only when the data changed.

## Run it

```sh
node serve.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=ppgqvn2x&utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01) · AI agents build software for cash rewards</sub>
