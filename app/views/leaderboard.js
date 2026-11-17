export { renderLeaderboard, virtualRows, leaderboardHeader };
// #/bounty/<slug>/leaderboard: every row comes in `?rows=first` (the first rows in full, the rest in brief), the same
// cached request the bounty pane's Top 10 made; the header comes from the open-bounties list the board made. So from a
// bounty this view costs no request, and loaded directly it costs those two. Drawn as a virtual list: only the rows in
// view, plus a few, are in the DOM, reused as it scrolls and patched in place on refresh.
import { bountyFor, getLeaderboard, normalizeRows, patchRows, setHTML, paidPlaces, placeRuns, placeLabel, oddsFor, esc, notice, money, num, pot, countdown, timeBar,
  perEntry, shortDate, crumbs, userLink } from './shared.js';

async function renderLeaderboard(el, { b: slug }, live) {
  const [lb, b] = await Promise.all([getLeaderboard(slug, live), bountyFor(slug, live).catch(() => null)]);
  if (live && lb === st.data && b === st.bounty) return;
  if (st.slug !== slug) Object.assign(st, { slug, q: '' });
  Object.assign(st, { data: lb, bounty: b, prizes: b ? paidPlaces(b) : [], rows: normalizeRows(lb) });
  const c = lb.competition || {}, col = lb.columns?.find((x) => x.key === lb.rank_key);
  if (!live || !el.querySelector('.lb-head')) {
    const back = `#/bounty/${encodeURIComponent(slug)}`;
    el.innerHTML = `${crumbs([c.title || slug, back], ['Leaderboard'])}
<section class="head-row"><div><h1>${esc(c.title || slug)} <span class="muted">leaderboard</span></h1><p class="lb-meta"></p></div><a class="btn ghost" href="${back}">Bounty details</a></section>
<section class="lb-head panel"></section>
${st.rows.length ? `<div class="panel lbp"><div class="lb-tools"><input id="who" type="search" placeholder="Find a handle…" aria-label="Find a handle" value="${esc(st.q)}"><span class="count"></span></div>
<div class="lbrow lbh" role="row"><span class="num" title="Rank">#</span><span>Entrant</span><span>Entry</span><span class="num">${esc(col?.title || 'Score')}</span><span>Interval</span><span class="num">Prize now</span><span>Valid</span><span>Received</span></div>
<div class="vscroll" tabindex="0" role="table" aria-label="Leaderboard rows"><div class="vsizer"><div class="vrows"></div></div></div></div>`
    : notice(lb.phase?.placements_held ? 'Placements are held' : 'No entries yet', lb.phase?.placements_held ? 'This board lists its entries once the results are published.' : 'Be the first: enter from the bounty page.')}`;
    el.querySelector('#who')?.addEventListener('input', (e) => { st.q = e.target.value.trim().toLowerCase(), filterRows(el), (el.querySelector('.vscroll').scrollTop = 0), virtualRows(el); });
    const box = el.querySelector('.vscroll'), redraw = () => st.raf || (st.raf = requestAnimationFrame(() => ((st.raf = 0), virtualRows(el))));
    box?.addEventListener('scroll', redraw, { passive: true });
    if (box) new ResizeObserver(redraw).observe(box);
  }
  const ranked = st.rows.filter((r) => r.rank != null).length;
  el.querySelector('.lb-meta').textContent = `${num(st.rows.length)} entries · ${num(ranked)} ranked · ${lb.phase?.title || ''} phase · ranked by ${col?.title || lb.rank_key}${lb.phase?.placements_held ? ' · places unofficial until results publish' : ''}`;
  setHTML(el.querySelector('.lb-head'), b ? leaderboardHeader(b) : '<p class="muted">Bounty details are unavailable right now.</p>');
  if (st.rows.length) filterRows(el), virtualRows(el);
}

/** Draws the rows the scroller shows (and OVERSCAN either side) over a sizer as tall as every row: a 6,000-row board keeps ~40 rows in the DOM. */
function virtualRows(el) {
  const box = el.querySelector('.vscroll');
  if (!box) return;
  const n = st.view.length, top = box.scrollTop, h = box.clientHeight || 480;
  const from = Math.max(0, Math.floor(top / ROW) - OVERSCAN), to = Math.min(n, Math.ceil((top + h) / ROW) + OVERSCAN);
  el.querySelector('.vsizer').style.height = `${Math.max(n, 1) * ROW}px`;
  const rows = el.querySelector('.vrows');
  rows.style.transform = `translateY(${from * ROW}px)`;
  patchRows(rows, n ? st.view.slice(from, to).map((r) => [r.id, rowHtml(r)]) : [['~none', `<div class="lbrow none">No handle matches “${esc(st.q)}”.</div>`]]);
  const first = Math.min(n, Math.floor(top / ROW) + 1), last = Math.min(n, Math.floor((top + h) / ROW));
  el.querySelector('.count').textContent = `Rows ${num(n ? first : 0)}–${num(last)} of ${num(n)}${st.q ? ` matching “${st.q}”` : ''} · ${rows.children.length} in the DOM (virtual list)`;
}

function leaderboardHeader(b) {
  const runs = placeRuns(st.prizes), o = oddsFor(b);
  return `<div class="stats"><div class="potbig"><small>Live pot</small><b>${money(pot(b))}</b></div>
<div><small>Time left</small><b>${countdown(b.deadline)}</b>${timeBar(b.opensAt || b.publishedAt, b.deadline)}</div>
<div><small>Entry fee</small><b>${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</b></div>
<div><small>Entries</small><b>${num(b.submissionCount)}</b></div></div>
<div class="places"><small>${st.prizes.length} paid places · ${o.per == null ? 'no entries yet' : `${perEntry(o.per)} per entry · ${o.label}`}</small><ol>${runs.map((r) => `<li><b>${placeLabel(r)}</b> ${money(r.amountUsd)}${r.n > 1 ? ' each' : ''}</li>`).join('')}</ol></div>`;
}

const rowHtml = (r) => `<div class="lbrow${r.house ? ' house' : ''}" role="row"><span class="num rank">${r.rank ?? '—'}</span><span class="h">${userLink(r.handle)}</span>
<span class="ttl" title="${esc(r.title)}">${esc(r.title || '—')}</span><span class="num"><b>${esc(r.score)}</b></span><span class="muted">${esc(r.iv) || '—'}</span>
<span class="num">${prizeFor(r)}</span><span>${r.valid ? '<i class="chip ok">✓ valid</i>' : '<i class="chip">✗</i>'}</span><span class="muted">${shortDate(r.at)}</span></div>`;
const prizeFor = (r) => { const p = r.prize && st.prizes[r.prize - 1]; return p ? `<b class="win">${money(p.amountUsd)}</b>` : '<span class="muted">—</span>'; };
const filterRows = () => { st.view = st.q ? st.rows.filter((r) => r.handle.toLowerCase().includes(st.q)) : st.rows; };
const onKey = (k) => k === 'Escape' && ((location.hash = `#/bounty/${encodeURIComponent(st.slug)}`), true);

const ROW = 40, OVERSCAN = 8;
const st = { slug: null, data: null, bounty: null, prizes: [], rows: [], view: [], q: '', raf: 0 };

export { renderLeaderboard as leaderboard, onKey };
