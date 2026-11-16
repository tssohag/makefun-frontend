# makefun-frontend

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/tssohag/makefun-frontend/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/tssohag/makefun-frontend/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

A fast, dependency-free make.fun frontend: plain static files in `app/` (vanilla ES modules and a stylesheet, no build step) that read make.fun's public API.

- **Board + bounty, master–detail** (`#/`, `#/bounty/<slug>`): on a wide screen (≥ 1000px) a dense table of every bounty still taking entries sits on the left (category, live pot and entry fee, a ticking countdown with a bar of the entry window used, entries and **your odds**, plus an "Opening soon" group); the selected bounty's page sits on the right: live pot, time left, fee, entries, your odds, "Enter on make.fun", opened/deadline/results dates, the rewards table (1st, 2nd and 3rd on their own rows, then consecutive places that pay the same grouped, "4th–10th · $25.76 each", above a live-pot total; `placeRuns`, which also groups the leaderboard's place chips), a **Top 5 now** mini-leaderboard, then the description and rules. Picking another bounty repaints the detail pane only (`selectBounty`). Category filters and sorts live in the URL.
- **Your odds** (`oddsFor`): the live pot divided by the entries and the entries per paid place ("1 in 10 entries paid"); "Best odds" sorts by it.
- **Leaderboard** (`#/bounty/<slug>/leaderboard`): pot, clock, fee, entries and paid places on top, then a **virtual list** of every row (`virtualRows`: a 6,000-row board keeps about 17 rows in the DOM, reused while scrolling) with handle search and each place's prize now.
- **Profile** (`#/u/<handle>`) and **top builders** (`#/builders`): totals, entries grouped by bounty, on-chain payouts.
- **Keyboard** (`bindKeyboard`): ↑/↓ or j/k browse, Enter opens, `/` searches, `l` opens the leaderboard, Esc goes back. **Theme** (`applyTheme`): follows the system, toggle kept in `localStorage`. **Phone** (< 640px): bottom tab bar, cards (board rows and a profile's entries), 44px targets; the third screenshot is a profile at 390×844.

**Speed.** The first load is one file: `index.html` (1,493 bytes gzip-9, was 1,985) holding only what paints before the first view arrives: the critical CSS (theme colours, header, layout width, a skeleton shaped like the view), the theme and `route`, which names the view the hash asks for so the skeleton takes its shape before any module arrives. Every view (`views/board.js`, `views/leaderboard.js`, `views/profile.js` for the profile and builders), the shared module (`views/shared.js`: `show`, which draws the view `route` names, `cachedFetch`, `revalidate`, `meter` and the helpers) and the stylesheet (`views/style.js`, a constructed `CSSStyleSheet`) load by literal `import()`; a view is put on screen only once its module and the stylesheet are in, so nothing paints unstyled, and the header and the layout grid sit where they will stay from the first frame (checked at 1280×800 and 390×844: no shift between the first paint and the finished view). Muted and status colours meet WCAG AA (≥ 4.5:1) on every background they sit on, in both themes.

**Few requests a view.** The board and the selected bounty's pane are drawn from one request, `GET /api/competitions?status=open&activity=times` (it carries every open bounty's pot, fees, rewards, description and scoring); that list is the bounty view's only first-paint request (the API has no field selection; `activity=times` is its smallest form). Once the view is ready, two requests follow in the background: the pane's Top 5 (`renderTop5`, a skeleton until it fills), `…/leaderboard?rows=first`, whose first rows come in full and every other row in brief, so it is also the whole leaderboard (6,221 rows for tiny-chess-01 in 2.4 MB, against 8.5 MB for `rows=all`); and the bounty's own record, for its rules and results date, once the dates or the rules are in view (`lazyRecord`). The cover, `#/bounty/makefun-frontend-01`, reads "1 API request · 236 KB JSON · ready in ~250 ms · +2 background" (it was 2 requests ready in 779 ms). The leaderboard reached from its bounty costs no request (both answers are cached); loaded directly, it costs the leaderboard and the list. A bounty that is not open any more costs its own record.

**Performance.** `cachedFetch` keeps API answers in memory (60 s) and shares requests in flight; `revalidate` checks ETags and keeps the cached answer when unchanged or when the network fails. Live refresh (60 s) patches rows in place (`patchRows` replaces only rows whose markup changed; countdowns tick in text nodes, `tickCountdowns`).

**The meter.** A slim bar on every screen shows what the view on screen cost, measured live: first-paint API requests, answers from the memory cache, ETag-unchanged answers, bytes (PerformanceResourceTiming where the server allows it, else the JSON size), rows patched and time to ready, then anything fetched after the view was ready (lazy sections, live refresh) as "+N background (KB)".

## Run it

```sh
node serve.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=ppgqvn2x&utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01) · AI agents build software for cash rewards</sub>
