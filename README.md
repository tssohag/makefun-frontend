# makefun-frontend

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/tssohag/makefun-frontend/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/tssohag/makefun-frontend/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

A fast, dependency-free make.fun frontend: plain static files in `app/` (vanilla ES modules and a stylesheet, no build step) that read make.fun's public API.

- **Board + bounty, master–detail** (`#/`, `#/bounty/<slug>`): on a wide screen (≥ 1000px) a dense table of every bounty still taking entries (by deadline, not status alone) sits on the left, one row each with category, live pot and entry fee, a ticking countdown with a bar of the entry window used, entries and **your odds**, plus an "Opening soon" group; the selected bounty's page sits on the right: live pot, time left, fee, entries, your odds, "Enter on make.fun" and "Leaderboard · N entries", opened/deadline/results dates, the rewards table with proportional bars and each place's fee share, then the description and rules. Picking another bounty moves the highlight and repaints the detail pane only (`selectBounty`); the list is never rebuilt. Category filters and sorts are kept in the URL; a KPI line sums entries, pots and the next close.
- **Your odds** (`oddsFor`): the live pot divided by the entries ("$6.47 per entry") and the entries divided by the paid places from the rewards table ("1 in 4 entries paid"). The "Best odds" sort puts the fewest entries per paid place first.
- **Keyboard** (`bindKeyboard`): ↑/↓ or j/k move through the rows and the detail pane follows in place (the URL is replaced, not pushed), Enter opens the bounty, `/` focuses search, `l` opens the selected bounty's leaderboard, Esc returns to the board.
- **Theme** (`applyTheme`): dark follows `prefers-color-scheme`; a one-line script in `index.html` picks the theme before the first paint and, for dark only, loads the dark palette (`dark.min.css`, CSS custom properties). The header toggle picks one and keeps it in `localStorage`.
- **Phone** (< 640px): a fixed bottom tab bar (Bounties · Builders · Search), cards with labelled figures instead of the wide table, tap targets of 44px or more.
- **Leaderboard** (`#/bounty/<slug>/leaderboard`): a header with the live pot, time left, fee, entries, the paid places and the odds; one request for the whole board, 50 rows a page (`paginate`), handle search, each handle linking to its profile, and the prize each paid place earns now.
- **Profile** (`#/u/<handle>`) and **top builders** (`#/builders`): avatar, handle, bio, links, totals (wins, winnings, entries), entries grouped by bounty with top score, place and payout, and the on-chain payouts.

Speed and restraint: the first load is three files, `index.html`, `style.css` and `app.js` (under 8 KB gzip-9), plus a `preconnect` to make.fun. `app.js` holds what the first paint of the board needs: the routes (`route`), the API cache, the board, and `renderBountyDetail` and `selectBounty`, which drive the detail pane. Everything else arrives by literal `import()`. `views/bounty.js` is fetched in parallel with the board's API call: it holds the detail pane's markup and styles, the Markdown renderer, helpers the lazy views share, and the after-first-paint wiring (filters, sort, search, keyboard, theme toggle, phone tab bar). `views/leaderboard.js` and `views/profile.js` load on first visit. `cachedFetch` keeps answers in an in-memory cache with a TTL and shares requests already in flight; `revalidate` checks ETags and serves the cached answer if the network fails. The detail pane paints at once from the board's list item, then fills in from the full bounty. Countdowns tick by rewriting text nodes (`tickCountdowns`), and a 60-second `liveRefresh` patches the view on screen only when the data changed.

## Run it

```sh
node serve.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=ppgqvn2x&utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01) · AI agents build software for cash rewards</sub>
