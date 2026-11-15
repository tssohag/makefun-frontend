// make.fun bounties: hash routes, a master–detail board, lazy views; the board is patched in place, never rebuilt.
import { getBounties } from './api.js';
import { renderBountyDetail, paidPlaces } from './bounty.js';

const leaderboardView = () => import('./views/leaderboard.js');
const profileView = () => import('./views/profile.js');

export async function route(live = false) {
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  const [a, b, c] = path.split('/').map(decodeURIComponent);
  if (!a && query) Object.assign(board, Object.fromEntries([...new URLSearchParams(query)].filter(([k]) => k === 'cat' || k === 'sort')));
  const masterDetail = !a || (a === 'bounty' && b && !c);
  if (live) {
    if (view?.path !== path) return;
    if (view.md) return Promise.all([renderBoard(view.el, true), refreshDetail(view.el)]).then(stamp, () => {});
    return view.run(view.el, true).then(stamp, () => {});
  }
  window.__shotReady = false;
  for (const n of document.querySelectorAll('#nav a')) n.toggleAttribute('aria-current', n.hash === (a === 'builders' || a === 'u' ? '#/builders' : masterDetail ? '#/' : ''));
  if (masterDetail && view?.md && view.el.isConnected) {
    const my = ++seq;
    view.path = path;
    await selectBounty(view.el, a ? b : null).catch(() => {});
    return my === seq && ready(view.el, my);
  }
  const run = masterDetail ? async (el) => { await renderBoard(el, false); await selectBounty(el, a ? b : null); }
    : a === 'bounty' && b && c === 'leaderboard' ? async (el, l) => (await leaderboardView()).renderLeaderboard(el, b, l)
    : a === 'u' && b ? async (el, l) => (await profileView()).renderProfile(el, b, l)
    : a === 'builders' ? async (el, l) => (await profileView()).renderBuilders(el, l)
    : async (el) => { el.innerHTML = notice('Page not found', 'That address is not a page of this app.'); };
  const my = ++seq;
  $app.innerHTML = masterDetail ? SKELETON_MD : SKELETON;
  scrollTo(0, 0);
  const el = document.createElement('div');
  el.className = 'view';
  try { await run(el, false); } catch (e) { el.innerHTML = notice('Could not load this page', e.name === 'TimeoutError' ? 'make.fun took too long to answer.' : e.message, true); }
  if (my !== seq) return;
  view = { el, path, run, md: masterDetail && !!el.querySelector('.md') };
  $app.replaceChildren(el);
  ready(el, my);
}

export async function renderBoard(el, live) {
  const res = await getBounties(live);
  if (live && res === board.data) return;
  board.data = res;
  const { open, soon } = boardGroups();
  const cats = ['All', ...[...new Set([...open, ...soon].map((b) => b.category).filter(Boolean))].sort()];
  if (!cats.includes(board.cat)) board.cat = 'All';
  if (!el.querySelector('.md')) {
    el.innerHTML = `<div class="md"><section class="board" aria-label="Live bounties">
<div class="bhead"><h1>Live bounties</h1><p class="kpi"></p></div>
<div class="tools"><div class="chips" role="group" aria-label="Category"></div>
<label class="sort">Sort <select id="sort">${Object.entries(SORTS).map(([k, [t]]) => `<option value="${k}">${t}</option>`).join('')}</select></label></div>
<div class="btable" role="table" aria-label="Bounties"><div class="brow bh" role="row"><span role="columnheader">Bounty</span><span class="num" role="columnheader">Live pot</span><span role="columnheader">Time left</span><span class="num" role="columnheader">Entries</span><span class="num" role="columnheader" title="Live pot per entry, and how many entries share each paid place">Your odds</span></div><div class="rows"></div></div>
<p class="hint">↑↓ to browse · Enter to open · / to search · L for leaderboard</p>
</section><section class="detail" aria-live="polite" tabindex="-1" hidden></section></div>`;
    el.querySelector('#sort').addEventListener('change', (e) => { board.sort = e.target.value; updateRows(el); });
    el.querySelector('.chips').addEventListener('click', (e) => { const c = e.target.closest('[data-cat]'); if (c) board.cat = c.dataset.cat, updateRows(el); });
  }
  el.querySelector('#sort').value = SORTS[board.sort] ? board.sort : 'soon';
  const total = open.reduce((s, b) => s + pot(b), 0), entries = open.reduce((s, b) => s + (b.submissionCount || 0), 0);
  const next = open.reduce((m, b) => (!m || Date.parse(b.deadline) < Date.parse(m.deadline) ? b : m), null);
  el.querySelector('.kpi').innerHTML = `<b>${open.length}</b> taking entries · <b>${money(total)}</b> in live pots · <b>${num(entries)}</b> entries${next ? ` · next closes in <b>${countdown(next.deadline)}</b>` : ''}`;
  el.querySelector('.chips').innerHTML = cats.map((c) => `<button type="button" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  updateRows(el);
}

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
  const fee = Number(b.entryFeeUsd || 0), o = oddsFor(b);
  return `<a class="brow" role="row" href="#/bounty/${encodeURIComponent(b.slug)}" data-slug="${esc(b.slug)}">
<span class="bt" role="cell"><b>${esc(b.title)}</b><small><i class="cat c-${esc((b.category || 'x').toLowerCase())}">${esc(b.category || 'Bounty')}</i>${esc(b.sponsor?.name || '')}</small></span>
<span class="num pot" role="cell" data-l="Live pot">${money(pot(b))}<small class="${fee ? 'fee' : 'free'}">${fee ? `${money(fee)} entry` : 'free entry'}</small></span>
<span class="tl" role="cell" data-l="Time left">${soon ? `<small>opens in</small> ${countdown(b.publishedAt)}` : `${countdown(b.deadline)}${timeBar(b.publishedAt, b.deadline)}`}</span>
<span class="num" role="cell" data-l="Entries">${num(b.submissionCount)}</span>
<span class="num od" role="cell" data-l="Your odds"><b>${o.per == null ? '—' : perEntry(o.per)}</b><small>${o.label}</small></span></a>`;
}

// Your odds: live pot per entry; entries per paid place.
export function oddsFor(b) {
  const n = b.submissionCount || 0, places = paidPlaces(b).filter((r) => Number(r.amountUsd) > 0).length;
  const ratio = places ? n / places : Infinity;
  return { n, places, ratio, per: n ? pot(b) / n : null,
    label: !places ? 'no paid places' : !n ? `${places} places paid` : n <= places ? 'all paid' : `1 in ${num(Math.round(ratio))} paid` };
}
export const sortByOdds = (x, y) => oddsFor(x).ratio - oddsFor(y).ratio || pot(y) - pot(x);
export const perEntry = (v) => (v < 0.01 ? '<$0.01' : money(v >= 10 ? Math.round(v) : Math.round(v * 100) / 100));

export async function selectBounty(el, slug) {
  if (!slug && wide.matches) slug = el.querySelector('.rows .brow')?.dataset.slug;
  board.sel = slug || null;
  const pane = el.querySelector('.detail');
  el.querySelector('.md').classList.toggle('has-sel', location.hash.startsWith('#/bounty/'));
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

// Keys: ↑↓/j k browse, Enter opens, / search, l leaderboard, Esc board.
export function bindKeyboard() {
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target, typing = /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName);
    if (e.key === 'Escape') return void (typing ? t.blur() : back());
    if (typing) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === '/') e.preventDefault(), focusSearch();
    else if (k === 'l' && board.sel) location.hash = `#/bounty/${encodeURIComponent(board.sel)}/leaderboard`;
    else if (!view?.md) return;
    else if (k === 'j' || k === 'k' || ((k === 'ArrowDown' || k === 'ArrowUp') && !t.closest?.('.detail'))) e.preventDefault(), step(k === 'j' || k === 'ArrowDown' ? 1 : -1);
    else if (k === 'Enter' && board.sel && !t.closest?.('a,button')) {
      const h = `#/bounty/${encodeURIComponent(board.sel)}`;
      if (location.hash !== h) location.hash = h; else view.el.querySelector('.detail').focus();
    }
  });
}
function step(d) {
  const rows = [...view.el.querySelectorAll('.rows .brow')], i = rows.findIndex((r) => r.dataset.slug === board.sel);
  const r = rows[Math.min(rows.length - 1, Math.max(0, i < 0 ? 0 : i + d))];
  if (!r) return;
  if (!wide.matches) return void (board.sel = r.dataset.slug, markSelected(view.el), r.scrollIntoView({ block: 'nearest' }));
  history.replaceState(null, '', r.getAttribute('href'));
  route();
}
function back() {
  if (view?.md && (wide.matches || !board.sel || !location.hash.startsWith('#/bounty/'))) return;
  location.hash = board.sel && wide.matches ? `#/bounty/${encodeURIComponent(board.sel)}` : '#/';
}
function focusSearch() {
  scrollTo(0, 0);
  $q.focus();
}

export function applyTheme(mode) {
  const root = document.documentElement;
  if (mode) { root.dataset.theme = mode; try { localStorage.theme = mode; } catch {} }
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : darkScheme.matches;
  $theme.setAttribute('aria-pressed', dark);
  $theme.title = `Switch to the ${dark ? 'light' : 'dark'} theme`;
}

export function tickCountdowns() {
  const now = Date.now();
  for (const n of document.querySelectorAll('[data-deadline]')) {
    const ms = Date.parse(n.dataset.deadline) - now, t = timeLeft(ms);
    if (n.firstChild.data !== t) n.firstChild.data = t;
    n.classList.toggle('soon', ms > 0 && ms < 864e5);
  }
  for (const n of document.querySelectorAll('.tbar[data-end]')) n.firstChild.style.width = barWidth(n.dataset.start, n.dataset.end, now);
}
export function liveRefresh() {
  if (document.visibilityState === 'visible') route(true);
}

async function ready(el, my) {
  document.title = (((board.sel && el.querySelector('.detail:not([hidden]) h1')) || el.querySelector('h1'))?.textContent || 'Bounties') + ' · make.fun';
  stamp();
  tickCountdowns();
  await Promise.race([Promise.all([...el.querySelectorAll('img')].map((i) => i.decode().catch(() => {}))), new Promise((r) => setTimeout(r, 3e3))]);
  if (my === seq) window.__shotReady = true;
}
const refreshDetail = (el) => (board.sel ? renderBountyDetail(el.querySelector('.detail'), board.sel, boardItem(board.sel), true) : null);
const stamp = () => { $live.textContent = `Live · ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`; };
export const countdown = (iso) => `<span class="cd" data-deadline="${esc(iso)}">${timeLeft(Date.parse(iso) - Date.now())}</span>`;
export function timeLeft(ms) {
  if (!(ms > 0)) return 'Closed';
  const s = Math.floor(ms / 1e3), d = Math.floor(s / 86400), p = (n) => String(n).padStart(2, '0');
  return `${d ? d + 'd ' : ''}${p(Math.floor(s / 3600) % 24)}h ${p(Math.floor(s / 60) % 60)}m ${p(s % 60)}s`;
}
const barWidth = (start, end, now = Date.now()) => `${Math.round(Math.min(1, Math.max(0, (now - Date.parse(start)) / (Date.parse(end) - Date.parse(start) || 1))) * 100)}%`;
export const timeBar = (start, end) => (start && end ? `<span class="tbar" data-start="${esc(start)}" data-end="${esc(end)}" title="Share of the entry window used"><i style="width:${barWidth(start, end)}"></i></span>` : '');

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const num = (n) => (n || 0).toLocaleString('en-US');
export function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? '$' + n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) : '—';
}
export const pot = (b) => Number(b.potUsd ?? b.rewardAmount ?? 0);
export const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
export const fmtDate = (iso, o) => (iso ? new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: o ? undefined : 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : '—');
export const notice = (title, text, retry) => `<div class="empty"><h2>${esc(title)}</h2><p>${esc(text)}</p>${retry ? '<button class="btn" type="button" data-retry>Try again</button>' : '<a class="btn" href="#/">Back to bounties</a>'}</div>`;
const SKELETON_MD = `<div class="md sk-md" aria-busy="true"><div>${'<div class="sk sk-row"></div>'.repeat(10)}</div><div class="sk sk-panel"></div></div>`;
const SKELETON = '<div aria-busy="true"><div class="sk sk-h"></div><div class="sk sk-panel"></div></div>';

const $ = (id) => document.getElementById(id);
const $app = $('app'), $q = $('q'), $live = $('live'), $theme = $('theme');
const wide = matchMedia('(min-width: 1000px)'), darkScheme = matchMedia('(prefers-color-scheme: dark)');
let seq = 0;
let view = null;
const board = { cat: 'All', sort: 'soon', data: null, sel: null };
const SORTS = { soon: ['Ending soon', (x, y) => Date.parse(x.deadline) - Date.parse(y.deadline)],
  odds: ['Best odds', sortByOdds], pot: ['Biggest pot', (x, y) => pot(y) - pot(x)],
  entries: ['Most entries', (x, y) => y.submissionCount - x.submissionCount], few: ['Fewest entries', (x, y) => x.submissionCount - y.submissionCount] };
function boardGroups(now = Date.now()) {
  const items = (board.data?.items || []).filter((b) => !b.demo && Date.parse(b.deadline) > now);
  return { open: items.filter((b) => !(Date.parse(b.publishedAt) > now)), soon: items.filter((b) => Date.parse(b.publishedAt) > now) };
}
const boardItem = (slug) => board.data?.items.find((b) => b.slug === slug);

$('search').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $q.value.trim();
  if (v[0] === '@' && v.length > 1) location.hash = `#/u/${encodeURIComponent(v.slice(1))}`;
  else if (!view?.md) location.hash = '#/';
});
$q.addEventListener('input', () => {
  if (!view?.md) return;
  if (!wide.matches && location.hash.startsWith('#/bounty/')) location.hash = '#/';
  updateRows(view.el);
});
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-retry]')) route();
  else if (e.target.closest('[data-search]')) focusSearch();
});
$theme.addEventListener('click', () => applyTheme($theme.getAttribute('aria-pressed') === 'true' ? 'light' : 'dark'));
darkScheme.addEventListener('change', () => applyTheme());
wide.addEventListener('change', () => { if (view?.md && !board.sel && wide.matches) selectBounty(view.el, null).then(tickCountdowns); });
addEventListener('hashchange', () => route());
applyTheme();
bindKeyboard();
setInterval(tickCountdowns, 1e3);
setInterval(liveRefresh, 60e3);
route();
