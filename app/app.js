// make.fun bounties: a hash-routed frontend on make.fun's public API (api.js).
//   #/                           renderBoard + renderBountyDetail  master–detail: board left, a bounty right
//   #/bounty/<slug>              selectBounty                      same board, that row selected (phone: the page)
//   #/bounty/<slug>/leaderboard  renderLeaderboard                 views/leaderboard.js, loaded on first visit
//   #/u/<handle>, #/builders     renderProfile, renderBuilders     views/profile.js, loaded on first visit
// Switching bounty never rebuilds the board: selectBounty moves the highlight and repaints the detail pane.
// The 60 s live refresh patches the view in place; countdowns tick by rewriting their text nodes only.
import { getBounties } from './api.js';
import { renderBountyDetail } from './bounty.js';

// Less-used views load on first visit, so they stay out of the first load.
const leaderboardView = () => import('./views/leaderboard.js');
const profileView = () => import('./views/profile.js');

export async function route(live = false) {
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  const [a, b, c] = path.split('/').map(decodeURIComponent);
  if (!a && query) Object.assign(board, Object.fromEntries([...new URLSearchParams(query)].filter(([k]) => k === 'cat' || k === 'sort')));
  const masterDetail = !a || (a === 'bounty' && b && !c);
  const slug = a ? b : null;
  if (live) {
    if (view?.path !== path) return;
    if (view.md) return Promise.all([renderBoard(view.el, true), refreshDetail(view.el)]).then(stamp, () => {});
    return view.run(view.el, true).then(stamp, () => {});
  }
  window.__shotReady = false;
  if (masterDetail && view?.md && view.el.isConnected) { // the board is on screen: update in place
    const my = ++seq;
    view.path = path;
    await selectBounty(view.el, slug).catch(() => {});
    return my === seq && ready(view.el, my);
  }
  const run = masterDetail ? async (el) => { await renderBoard(el, false); await selectBounty(el, slug); }
    : a === 'bounty' && b && c === 'leaderboard' ? async (el, l) => (await leaderboardView()).renderLeaderboard(el, b, l)
    : a === 'u' && b ? async (el, l) => (await profileView()).renderProfile(el, b, l)
    : a === 'builders' ? async (el, l) => (await profileView()).renderBuilders(el, l)
    : async (el) => { el.innerHTML = notice('Page not found', 'That address is not a page of this app.'); };
  const my = ++seq;
  $app.innerHTML = renderSkeleton(masterDetail);
  scrollTo(0, 0);
  const el = document.createElement('div');
  el.className = 'view';
  try { await run(el, false); } catch (e) { el.innerHTML = notice('Could not load this page', e.name === 'TimeoutError' ? 'make.fun took too long to answer.' : e.message, true); }
  if (my !== seq) return;
  view = { el, path, run, md: masterDetail && !!el.querySelector('.md') };
  $app.replaceChildren(el);
  ready(el, my);
}

async function ready(el, my) {
  document.title = (((board.sel && el.querySelector('.detail:not([hidden]) h1')) || el.querySelector('h1'))?.textContent || 'Bounties') + ' · make.fun';
  stamp();
  tickCountdowns();
  await imagesReady(el);
  if (my === seq) window.__shotReady = true;
}

// ---- the board (master) ----
// Built once per visit; filters, sort, search and the live refresh re-draw only the rows.
export async function renderBoard(el, live) {
  const res = await getBounties(live);
  if (live && res === board.data) return; // 304: nothing changed
  board.data = res;
  const { open, soon } = boardGroups();
  const cats = ['All', ...new Set([...open, ...soon].map((b) => b.category).filter(Boolean))].sort((x, y) => (x === 'All' ? -1 : y === 'All' ? 1 : x.localeCompare(y)));
  if (!cats.includes(board.cat)) board.cat = 'All';
  if (!el.querySelector('.md')) {
    el.innerHTML = `<div class="md"><section class="board" aria-label="Live bounties">
<div class="bhead"><h1>Live bounties</h1><p class="kpi"></p></div>
<div class="tools"><div class="chips" role="group" aria-label="Category"></div>
<label class="sort">Sort <select id="sort">${Object.entries(SORTS).map(([k, [t]]) => `<option value="${k}">${t}</option>`).join('')}</select></label></div>
<div class="btable" role="table" aria-label="Bounties"><div class="brow bh" role="row"><span role="columnheader">Bounty</span><span class="num" role="columnheader">Live pot</span><span role="columnheader">Time left</span><span class="num" role="columnheader">Fee</span><span class="num" role="columnheader">Entries</span></div><div class="rows"></div></div>
</section><section class="detail" aria-live="polite" hidden></section></div>`;
    el.querySelector('#sort').addEventListener('change', (e) => { board.sort = e.target.value; updateRows(el); });
    el.querySelector('.chips').addEventListener('click', (e) => { const c = e.target.closest('[data-cat]'); if (c) board.cat = c.dataset.cat, updateRows(el); });
  }
  el.querySelector('#sort').value = SORTS[board.sort] ? board.sort : 'soon';
  const total = open.reduce((s, b) => s + pot(b), 0), entries = open.reduce((s, b) => s + (b.submissionCount || 0), 0);
  const next = open.reduce((m, b) => (!m || Date.parse(b.deadline) < Date.parse(m.deadline) ? b : m), null);
  el.querySelector('.kpi').innerHTML = `<b>${open.length}</b> taking entries · <b>${money(total)}</b> in live pots · <b>${entries.toLocaleString('en-US')}</b> entries${next ? ` · next closes in <b>${countdown(next.deadline)}</b>` : ''}`;
  el.querySelector('.chips').innerHTML = cats.map((c) => `<button type="button" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  updateRows(el);
}

// Re-draws the rows alone (filter, sort, search, live data) and keeps the selection.
function updateRows(el) {
  if (!SORTS[board.sort]) board.sort = 'soon';
  const q = $q.value.trim().toLowerCase();
  const keep = (b) => (board.cat === 'All' || b.category === board.cat) && (!q || q[0] === '@' || `${b.title} ${b.category} ${b.summary}`.toLowerCase().includes(q));
  const { open, soon } = boardGroups();
  const rows = open.filter(keep).sort(SORTS[board.sort][1]), later = soon.filter(keep);
  for (const c of el.querySelectorAll('[data-cat]')) c.setAttribute('aria-pressed', c.dataset.cat === board.cat);
  if (!location.hash.replace(/^#\/?/, '').split('?')[0]) history.replaceState(null, '', board.cat === 'All' && board.sort === 'soon' ? '#/' : `#/?${new URLSearchParams({ cat: board.cat, sort: board.sort })}`);
  el.querySelector('.rows').innerHTML = rows.map((b) => boardRow(b)).join('')
    + (later.length ? `<div class="group" role="row"><span role="cell">Opening soon · ${later.length}</span></div>${later.map((b) => boardRow(b, true)).join('')}` : '')
    || `<div class="none">${q ? `Nothing matches “${esc(q)}”.` : 'No live bounties in this category right now.'}</div>`;
  markSelected(el);
  tickCountdowns();
}

export function boardRow(b, soon = false) {
  const fee = Number(b.entryFeeUsd || 0);
  return `<a class="brow" role="row" href="#/bounty/${encodeURIComponent(b.slug)}" data-slug="${esc(b.slug)}">
<span class="bt" role="cell"><b>${esc(b.title)}</b><small><i class="cat c-${esc((b.category || 'x').toLowerCase())}">${esc(b.category || 'Bounty')}</i>${esc(b.sponsor?.name || '')}</small></span>
<span class="num pot" role="cell">${money(pot(b))}</span>
<span class="tl" role="cell">${soon ? `<small>opens in</small> ${countdown(b.publishedAt)}` : `${countdown(b.deadline)}${timeBar(b.publishedAt, b.deadline)}`}</span>
<span class="num${fee ? ' fee' : ' free'}" role="cell">${fee ? money(fee) : 'Free'}</span>
<span class="num" role="cell">${(b.submissionCount || 0).toLocaleString('en-US')}</span></a>`;
}

// Moves the highlight to `slug` (or the first open bounty on a wide screen) and paints its detail pane.
export async function selectBounty(el, slug) {
  if (!slug && wide.matches) slug = el.querySelector('.rows .brow')?.dataset.slug;
  board.sel = slug || null;
  const pane = el.querySelector('.detail');
  el.querySelector('.md').classList.toggle('has-sel', !!location.hash.match(/^#\/bounty\//));
  markSelected(el);
  if (wide.matches && el.isConnected) el.querySelector('.brow.sel')?.scrollIntoView({ block: 'nearest' });
  if (!slug) return void (pane.hidden = true, pane.dataset.slug = '');
  pane.hidden = false;
  if (!wide.matches) scrollTo(0, 0);
  await renderBountyDetail(pane, slug, boardItem(slug));
}

function markSelected(el) {
  for (const r of el.querySelectorAll('.rows .brow')) {
    const on = r.dataset.slug === board.sel;
    r.classList.toggle('sel', on);
    if (on) r.setAttribute('aria-current', 'true'); else r.removeAttribute('aria-current');
  }
}

const refreshDetail = (el) => (board.sel ? renderBountyDetail(el.querySelector('.detail'), board.sel, boardItem(board.sel), true) : null);

// ---- live time ----
export function tickCountdowns() {
  const now = Date.now();
  for (const n of document.querySelectorAll('[data-deadline]')) {
    const ms = Date.parse(n.dataset.deadline) - now, t = timeLeft(ms);
    if (n.firstChild.data !== t) n.firstChild.data = t;
    n.classList.toggle('soon', ms > 0 && ms < 864e5);
  }
  for (const n of document.querySelectorAll('.tbar[data-end]')) n.firstChild.style.width = barWidth(n.dataset.start, n.dataset.end, now);
}
// Every 60 s the shown view re-reads its data (revalidated by ETag) and patches itself in place.
function liveRefresh() {
  if (document.visibilityState === 'visible') route(true);
}
export const countdown = (iso) => `<span class="cd" data-deadline="${esc(iso)}">${timeLeft(Date.parse(iso) - Date.now())}</span>`;
export function timeLeft(ms) {
  if (!(ms > 0)) return 'Closed';
  const s = Math.floor(ms / 1e3), d = Math.floor(s / 86400), p = (n) => String(n).padStart(2, '0');
  return `${d ? d + 'd ' : ''}${p(Math.floor(s / 3600) % 24)}h ${p(Math.floor(s / 60) % 60)}m ${p(s % 60)}s`;
}
// A thin bar of the entry window already used: full means the deadline has come.
const barWidth = (start, end, now = Date.now()) => `${Math.round(Math.min(1, Math.max(0, (now - Date.parse(start)) / (Date.parse(end) - Date.parse(start) || 1))) * 100)}%`;
export const timeBar = (start, end) => (start && end ? `<span class="tbar" data-start="${esc(start)}" data-end="${esc(end)}" title="Share of the entry window used"><i style="width:${barWidth(start, end)}"></i></span>` : '');
// Avatars in view decode before the route reports ready (at most 3 s).
const imagesReady = (el) => Promise.race([Promise.all([...el.querySelectorAll('img')].map((i) => i.decode().catch(() => {}))), new Promise((r) => setTimeout(r, 3e3))]);
function stamp() {
  const t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('live').textContent = `Live · ${t}`;
}

// ---- shared helpers for every view ----
export const fmtScore = (key, v, d) => (v == null ? '—' : key === 'judge' ? (v / 1e4).toFixed(1) + '%' : d ?? String(v));
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? '$' + n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) : '—';
}
export const pot = (b) => Number(b.potUsd ?? b.rewardAmount ?? 0);
export const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : '—');
export const dayTime = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : '—');
export const shortDate = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const avatar = (url, handle, cls = 'av') => (url
  ? `<img class="${cls}" crossorigin="anonymous" src="${esc(/^https?:/.test(url) ? url : 'https://make.fun' + url)}" alt="" decoding="async">`
  : `<span class="${cls}" aria-hidden="true">${esc((handle || '?')[0].toUpperCase())}</span>`);
export const crumbs = (...links) => `<nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Bounties</a>${links.map(([t, h]) => ` <span>›</span> ${h ? `<a href="${h}">${esc(t)}</a>` : `<b>${esc(t)}</b>`}`).join('')}</nav>`;
export const notice = (title, text, retry) => `<div class="empty"><h2>${esc(title)}</h2><p>${esc(text)}</p>${retry ? '<button class="btn" type="button" data-retry>Try again</button>' : '<a class="btn" href="#/">Back to bounties</a>'}</div>`;
const renderSkeleton = (md) => (md
  ? `<div class="md sk-md" aria-busy="true"><div>${'<div class="sk sk-row"></div>'.repeat(10)}</div><div class="sk sk-panel"></div></div>`
  : '<div class="sk-wrap" aria-busy="true"><div class="sk sk-h"></div><div class="sk sk-panel"></div></div>');

// ---- state and start ----
const LIVE_MS = 60e3;
const $app = document.getElementById('app');
const $q = document.getElementById('q');
const wide = matchMedia('(min-width: 1000px)');
let seq = 0;
let view = null; // { el, path, run, md } on screen
const board = { cat: 'All', sort: 'soon', data: null, sel: null };
const SORTS = { soon: ['Ending soon', (x, y) => Date.parse(x.deadline) - Date.parse(y.deadline)],
  pot: ['Biggest pot', (x, y) => pot(y) - pot(x)], entries: ['Most entries', (x, y) => y.submissionCount - x.submissionCount],
  few: ['Fewest entries', (x, y) => x.submissionCount - y.submissionCount] };
// Taking entries: opened and deadline ahead (status alone can lag); opening soon: published in the future.
function boardGroups(now = Date.now()) {
  const items = (board.data?.items || []).filter((b) => !b.demo && Date.parse(b.deadline) > now);
  return { open: items.filter((b) => !(Date.parse(b.publishedAt) > now)), soon: items.filter((b) => Date.parse(b.publishedAt) > now) };
}
const boardItem = (slug) => board.data?.items.find((b) => b.slug === slug);

document.getElementById('search').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $q.value.trim();
  if (v[0] === '@' && v.length > 1) location.hash = `#/u/${encodeURIComponent(v.slice(1))}`;
  else if (!view?.md) location.hash = '#/';
});
$q.addEventListener('input', () => { if (view?.md) updateRows(view.el); });
document.addEventListener('click', (e) => { if (e.target.closest('[data-retry]')) route(); });
wide.addEventListener('change', () => { if (view?.md && !board.sel && wide.matches) selectBounty(view.el, null).then(tickCountdowns); });
addEventListener('hashchange', () => route());
setInterval(tickCountdowns, 1e3);
setInterval(liveRefresh, LIVE_MS);
route();
