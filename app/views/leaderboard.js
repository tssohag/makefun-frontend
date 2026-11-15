// #/bounty/<slug>/leaderboard: one request (?rows=first) holds every row; only the visible
// page of PER rows is in the DOM. Paging and the handle search re-draw the tbody alone.
import { getLeaderboard } from '../api.js';
import { esc, crumbs, notice, fmtScore } from '../app.js';

const PER = 50;
const st = { data: null, rows: [], page: 0, q: '' };

export async function renderLeaderboard(el, slug, live) {
  const lb = await getLeaderboard(slug, live);
  if (live && lb === st.data) return;
  if (st.data?.competition?.slug !== slug) Object.assign(st, { page: 0, q: '' });
  st.data = lb;
  st.rows = normalizeRows(lb);
  const c = lb.competition || {}, col = lb.columns?.find((x) => x.key === lb.rank_key);
  if (!live || !el.querySelector('tbody')) {
    const back = `#/bounty/${encodeURIComponent(slug)}`;
    el.innerHTML = `${crumbs([c.title || slug, back], ['Leaderboard'])}
<section class="head-row"><div><h1>${esc(c.title || slug)} <span class="muted">leaderboard</span></h1>
<p class="lb-meta"></p></div><a class="btn ghost" href="${back}">Bounty details</a></section>
${st.rows.length ? `<div class="panel"><div class="lb-tools"><input id="who" type="search" placeholder="Find a handle…" aria-label="Find a handle" value="${esc(st.q)}"><span class="count"></span></div>
<div class="scroll"><table class="tbl lb"><thead><tr><th class="num">Rank</th><th>Entrant</th><th>Entry</th><th class="num">${esc(col?.title || 'Score')}</th><th>Interval</th><th>Valid</th><th>Received</th></tr></thead><tbody></tbody></table></div>
<nav class="pager" aria-label="Pages"><button type="button" data-go="-1">‹ Prev</button><span class="pg"></span><button type="button" data-go="1">Next ›</button></nav></div>`
    : notice(lb.phase?.placements_held ? 'Placements are held' : 'No entries yet', lb.phase?.placements_held ? 'This board lists its entries once the results are published.' : 'Be the first: enter from the bounty page.')}`;
    el.addEventListener('input', (e) => { if (e.target.id === 'who') st.q = e.target.value.trim().toLowerCase(), (st.page = 0), drawPage(el); });
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) st.page += +b.dataset.go, drawPage(el), el.querySelector('.panel').scrollIntoView({ block: 'start' }); });
  }
  const ranked = st.rows.filter((r) => r.rank != null).length;
  el.querySelector('.lb-meta').textContent = `${st.rows.length.toLocaleString('en-US')} entries · ${ranked.toLocaleString('en-US')} ranked · ${lb.phase?.title || ''} phase · ranked by ${col?.title || lb.rank_key}${lb.phase?.placements_held ? ' · places unofficial until results publish' : ''}`;
  if (st.rows.length) drawPage(el);
}

// The full rows (top ten) and the light `rest` rows, in one shape.
export function normalizeRows(lb) {
  const k = lb.rank_key;
  const row = (r, v, d, valid) => ({ rank: r.rank, handle: r.handle, title: r.title, house: r.house || r.baseline, at: r.received_at,
    score: fmtScore(k, v, d), iv: r.interval ? `${fmtScore(k, +r.interval.low)} – ${fmtScore(k, +r.interval.high)}` : '', valid });
  return [...(lb.entries || []).map((e) => row(e, e.values?.[k], e.display?.[k], e.values?.valid ?? +(e.rank != null))),
    ...(lb.rest || []).map((r) => row(r, r.value, r.display, +(r.rank != null)))];
}

const shortDate = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const paginate = (rows, page) => rows.slice(page * PER, page * PER + PER);

function drawPage(el) {
  const rows = st.q ? st.rows.filter((r) => r.handle?.toLowerCase().includes(st.q)) : st.rows;
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  st.page = Math.min(Math.max(st.page, 0), pages - 1);
  el.querySelector('tbody').innerHTML = paginate(rows, st.page).map((r) => `<tr${r.house ? ' class="house"' : ''}>
<td class="num rank">${r.rank ?? '—'}</td><td><a href="#/u/${encodeURIComponent(r.handle)}">@${esc(r.handle)}</a></td>
<td class="ttl" title="${esc(r.title)}">${esc(r.title || '—')}</td><td class="num"><b>${esc(r.score)}</b></td>
<td class="muted">${esc(r.iv) || '—'}</td><td>${r.valid ? '<span class="chip ok">✓ valid</span>' : '<span class="chip">✗</span>'}</td>
<td class="muted">${shortDate(r.at)}</td></tr>`).join('') || `<tr><td colspan="7" class="muted">No handle matches “${esc(st.q)}”.</td></tr>`;
  el.querySelector('.count').textContent = `Showing ${rows.length ? st.page * PER + 1 : 0}–${Math.min(rows.length, st.page * PER + PER)} of ${rows.length.toLocaleString('en-US')}`;
  el.querySelector('.pg').textContent = `Page ${st.page + 1} of ${pages}`;
  const [prev, next] = el.querySelectorAll('[data-go]');
  prev.disabled = st.page === 0;
  next.disabled = st.page >= pages - 1;
}
