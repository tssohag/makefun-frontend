// #/bounty/<slug>/leaderboard: one request (?rows=first) holds every row, beside the bounty
// (cached if the board showed it) for the header: live pot, time left, paid places. Only the
// visible page of PER rows is in the DOM; paging and the handle search re-draw the tbody alone.
import { getLeaderboard, getBounty } from '../api.js';
import { esc, crumbs, notice, fmtScore, money, pot, ordinal, countdown, timeBar, shortDate } from '../app.js';
import { paidPlaces } from '../bounty.js';

export async function renderLeaderboard(el, slug, live) {
  const [lb, b] = await Promise.all([getLeaderboard(slug, live), getBounty(slug, live).catch(() => null)]);
  if (live && lb === st.data && b === st.bounty) return;
  if (st.data?.competition?.slug !== slug) Object.assign(st, { page: 0, q: '' });
  st.data = lb;
  st.bounty = b;
  st.prizes = b ? paidPlaces(b) : [];
  st.rows = normalizeRows(lb);
  const c = lb.competition || {}, col = lb.columns?.find((x) => x.key === lb.rank_key);
  if (!live || !el.querySelector('tbody')) {
    const back = `#/bounty/${encodeURIComponent(slug)}`;
    el.innerHTML = `${crumbs([c.title || slug, back], ['Leaderboard'])}
<section class="head-row"><div><h1>${esc(c.title || slug)} <span class="muted">leaderboard</span></h1>
<p class="lb-meta"></p></div><a class="btn ghost" href="${back}">Bounty details</a></section>
<section class="lb-head panel"></section>
${st.rows.length ? `<div class="panel"><div class="lb-tools"><input id="who" type="search" placeholder="Find a handle…" aria-label="Find a handle" value="${esc(st.q)}"><span class="count"></span><nav class="pager" aria-label="Pages"><button type="button" data-go="-1">‹ Prev</button><span class="pg"></span><button type="button" data-go="1">Next ›</button></nav></div>
<div class="scroll"><table class="tbl lb"><thead><tr><th class="num">Rank</th><th>Entrant</th><th>Entry</th><th class="num">${esc(col?.title || 'Score')}</th><th>Interval</th><th class="num">Prize now</th><th>Valid</th><th>Received</th></tr></thead><tbody></tbody></table></div>
<nav class="pager" aria-label="Pages"><button type="button" data-go="-1">‹ Prev</button><span class="pg"></span><button type="button" data-go="1">Next ›</button></nav></div>`
    : notice(lb.phase?.placements_held ? 'Placements are held' : 'No entries yet', lb.phase?.placements_held ? 'This board lists its entries once the results are published.' : 'Be the first: enter from the bounty page.')}`;
    el.addEventListener('input', (e) => { if (e.target.id === 'who') st.q = e.target.value.trim().toLowerCase(), (st.page = 0), renderPage(el); });
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) st.page += +b.dataset.go, renderPage(el), el.querySelector('.panel').scrollIntoView({ block: 'start' }); });
  }
  const ranked = st.rows.filter((r) => r.rank != null).length;
  el.querySelector('.lb-meta').textContent = `${st.rows.length.toLocaleString('en-US')} entries · ${ranked.toLocaleString('en-US')} ranked · ${lb.phase?.title || ''} phase · ranked by ${col?.title || lb.rank_key}${lb.phase?.placements_held ? ' · places unofficial until results publish' : ''}`;
  el.querySelector('.lb-head').innerHTML = b ? leaderboardHeader(b) : '<p class="muted">Bounty details are unavailable right now.</p>';
  if (st.rows.length) renderPage(el);
}

// Live pot, time left, fee, entries, and the paid places with equal prizes run together (4th–10th $22.88).
export function leaderboardHeader(b) {
  const runs = [];
  for (const r of st.prizes) {
    const last = runs.at(-1);
    if (last && last.amountUsd === r.amountUsd) last.to = r.place; else runs.push({ ...r, to: r.place });
  }
  return `<div class="lbstats"><div class="potbig"><small>Live pot</small><b>${money(pot(b))}</b></div>
<div><small>Time left</small><b>${countdown(b.deadline)}</b>${timeBar(b.opensAt || b.publishedAt, b.deadline)}</div>
<div><small>Entry fee</small><b>${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</b></div>
<div><small>Entries</small><b>${(b.submissionCount || 0).toLocaleString('en-US')}</b></div></div>
<div class="places"><small>${st.prizes.length} paid places</small><ol>${runs.map((r) => `<li><b>${ordinal(r.place)}${r.to > r.place ? `–${ordinal(r.to)}` : ''}</b> ${money(r.amountUsd)}</li>`).join('')}</ol></div>`;
}

// Only the visible page of PER rows is ever rendered.
export const paginate = (rows, page) => rows.slice(page * PER, page * PER + PER);

// The full rows (top ten) and the light `rest` rows, in one shape.
export function normalizeRows(lb) {
  const k = lb.rank_key;
  const row = (r, v, d, valid) => ({ rank: r.rank, prize: r.prize_eligible === false ? null : r.prize_rank, handle: r.handle, title: r.title, house: r.house || r.baseline, at: r.received_at,
    score: fmtScore(k, v, d), iv: r.interval ? `${fmtScore(k, +r.interval.low)} – ${fmtScore(k, +r.interval.high)}` : '', valid });
  return [...(lb.entries || []).map((e) => row(e, e.values?.[k], e.display?.[k], e.values?.valid ?? +(e.rank != null))),
    ...(lb.rest || []).map((r) => row(r, r.value, r.display, +(r.rank != null)))];
}


function renderPage(el) {
  const rows = st.q ? st.rows.filter((r) => r.handle?.toLowerCase().includes(st.q)) : st.rows;
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  st.page = Math.min(Math.max(st.page, 0), pages - 1);
  el.querySelector('tbody').innerHTML = paginate(rows, st.page).map((r) => `<tr${r.house ? ' class="house"' : ''}>
<td class="num rank">${r.rank ?? '—'}</td><td><a href="#/u/${encodeURIComponent(r.handle)}">@${esc(r.handle)}</a></td>
<td class="ttl" title="${esc(r.title)}">${esc(r.title || '—')}</td><td class="num"><b>${esc(r.score)}</b></td>
<td class="muted">${esc(r.iv) || '—'}</td><td class="num">${prizeFor(r)}</td><td>${r.valid ? '<span class="chip ok">✓ valid</span>' : '<span class="chip">✗</span>'}</td>
<td class="muted">${shortDate(r.at)}</td></tr>`).join('') || `<tr><td colspan="8" class="muted">No handle matches “${esc(st.q)}”.</td></tr>`;
  el.querySelector('.count').textContent = `Showing ${rows.length ? st.page * PER + 1 : 0}–${Math.min(rows.length, st.page * PER + PER)} of ${rows.length.toLocaleString('en-US')}`;
  for (const n of el.querySelectorAll('.pg')) n.textContent = `Page ${st.page + 1} of ${pages}`;
  for (const b of el.querySelectorAll('[data-go]')) b.disabled = b.dataset.go < 0 ? st.page === 0 : st.page >= pages - 1;
}

const prizeFor = (r) => { const p = r.prize && st.prizes[r.prize - 1]; return p ? `<b class="win">${money(p.amountUsd)}</b>` : '<span class="muted">—</span>'; };

const PER = 50;
const st = { data: null, bounty: null, prizes: [], rows: [], page: 0, q: '' }; // the board shown, its page and handle search
