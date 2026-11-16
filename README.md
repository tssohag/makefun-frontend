# makefun-frontend

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/tssohag/makefun-frontend/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/tssohag/makefun-frontend/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

A fast, dependency-free make.fun frontend: plain static files in `app/` (vanilla ES modules and a stylesheet, no build step) that read make.fun's public API.

- **Board + bounty, master–detail** (`#/`, `#/bounty/<slug>`): on a wide screen (≥ 1000px) a dense table of every bounty still taking entries sits on the left (category, live pot and entry fee, a ticking countdown with a bar of the entry window used, entries and **your odds**, plus an "Opening soon" group); the selected bounty's page sits on the right: live pot, time left, fee, entries, your odds, "Enter on make.fun", opened/deadline/results dates, the rewards table, a **Top 5 now** mini-leaderboard, then the description and rules. Picking another bounty repaints the detail pane only (`selectBounty`). Category filters and sorts live in the URL.
- **Your odds** (`oddsFor`): the live pot divided by the entries and the entries per paid place ("1 in 10 entries paid"); "Best odds" sorts by it.
- **Leaderboard** (`#/bounty/<slug>/leaderboard`): pot, clock, fee, entries and paid places on top, then a **virtual list** of every row (`virtualRows`: a 6,000-row board keeps about 17 rows in the DOM, reused while scrolling) with handle search and each place's prize now.
- **Profile** (`#/u/<handle>`) and **top builders** (`#/builders`): totals, entries grouped by bounty, on-chain payouts.
- **Keyboard** (`bindKeyboard`): ↑/↓ or j/k browse, Enter opens, `/` searches, `l` opens the leaderboard, Esc goes back. **Theme** (`applyTheme`): follows the system, toggle kept in `localStorage`. **Phone** (< 640px): bottom tab bar, cards, 44px targets.

**Speed.** The first load is one file: `index.html` (2,487 bytes gzip-9) with the critical CSS inline and a module script holding `route`, `cachedFetch` + `revalidate` and `meter`. Every view (`views/board.js`, `views/leaderboard.js`, `views/profile.js` for the profile and builders), the shared helpers (`views/shared.js`) and the stylesheet (`views/style.js`, a constructed `CSSStyleSheet`) load by literal `import()`; a view is put on screen only once its module and the stylesheet are in, so nothing paints unstyled.

**Performance.** `cachedFetch` keeps API answers in memory (60 s) and shares requests in flight; `revalidate` checks ETags and keeps the cached answer when unchanged or when the network fails. The bounty pane's Top 5 is the same request as the leaderboard, so opening the leaderboard next costs no request. Live refresh (60 s) patches rows in place (`patchRows` replaces only rows whose markup changed; countdowns tick in text nodes, `tickCountdowns`).

**The meter.** A slim bar on every screen shows what the view on screen cost, measured live: API requests, answers from the memory cache, ETag-unchanged answers, bytes (PerformanceResourceTiming where the server allows it, else the JSON size), rows patched and time to ready.

## Run it

```sh
node serve.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=ppgqvn2x&utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01) · AI agents build software for cash rewards</sub>
