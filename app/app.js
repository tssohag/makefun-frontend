// make.fun bounties: a hash-routed frontend on make.fun's public API (api.js).
//   #/                           renderBoard        the live bounties (deadline still ahead)
//   #/bounty/<slug>              renderBounty       views/bounty.js, loaded on first visit
//   #/bounty/<slug>/leaderboard  renderLeaderboard  views/leaderboard.js, one request a board
//   #/u/<handle>, #/builders     renderProfile, renderBuilders  views/profile.js
// A route renders into a fresh node swapped in when its data is ready; the 60 s live refresh
// patches the current view in place, and countdowns tick by rewriting their text nodes only.
import { getBounties, getTopBuilders } from './api.js';

// Less-used views load on first visit, so they stay out of the first load.
const bountyView = () => import('./views/bounty.js');
const leaderboardView = () => import('./views/leaderboard.js');
const profileView = () => import('./views/profile.js');

export async function route(live = false) {
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  const [a, b, c] = path.split('/').map(decodeURIComponent);
  if (!a && query) Object.assign(board, Object.fromEntries([...new URLSearchParams(query)].filter(([k]) => k === 'cat' || k === 'sort')));
  const run = !a ? renderBoard
    : a === 'bounty' && b && !c ? async (el, l) => (await bountyView()).renderBounty(el, b, l)
    : a === 'bounty' && b && c === 'leaderboard' ? async (el, l) => (await leaderboardView()).renderLeaderboard(el, b, l)
    : a === 'u' && b ? async (el, l) => (await profileView()).renderProfile(el, b, l)
    : a === 'builders' ? async (el, l) => (await profileView()).renderBuilders(el, l)
    : async (el) => { el.innerHTML = notice('Page not found', 'That address is not a page of this app.'); };
  const my = ++seq;
  if (live) return view?.path === path && run(view.el, true).then(stamp, () => {});
  window.__shotReady = false;
  $app.innerHTML = renderSkeleton(a);
  scrollTo(0, 0);
  const el = document.createElement('div');
  el.className = 'view';
  try { await run(el, false); } catch (e) { el.innerHTML = notice('Could not load this page', e.name === 'TimeoutError' ? 'make.fun took too long to answer.' : e.message, true); }
  if (my !== seq) return;
  view = { el, path };
  $app.replaceChildren(el);
  document.title = (el.querySelector('h1')?.textContent || 'Bounties') + ' · make.fun';
  stamp();
  tickCountdowns();
  await imagesReady(el);
  if (my === seq) window.__shotReady = true;
}

export async function renderBoard(el, live) {
  const [res, top] = await Promise.all([getBounties(live), getTopBuilders(live).catch(() => null)]);
  if (live && res === board.data) return; // 304: nothing changed
  board.data = res;
  const list = liveBounties();
  const cats = ['All', ...new Set(list.map((b) => b.category).filter(Boolean))].sort((x, y) => (x === 'All' ? -1 : y === 'All' ? 1 : x.localeCompare(y)));
  if (!cats.includes(board.cat)) board.cat = 'All';
  const total = list.reduce((s, b) => s + pot(b), 0), entries = list.reduce((s, b) => s + (b.submissionCount || 0), 0);
  if (!live || !el.querySelector('.grid')) {
    el.innerHTML = `<section class="hero"><div><h1>Live bounties</h1><p class="muted">Every make.fun bounty still taking entries, with its live pot, fee and clock.</p></div>
<dl class="kpis"></dl></section><div class="tools"><div class="chips" role="group" aria-label="Category"></div>
<label class="sort">Sort <select id="sort">${Object.entries(SORTS).map(([k, [t]]) => `<option value="${k}">${t}</option>`).join('')}</select></label></div>
<div class="layout"><div class="grid"></div><aside class="side"></aside></div>`;
    el.querySelector('#sort').value = board.sort;
    el.addEventListener('change', (e) => { if (e.target.id === 'sort') board.sort = e.target.value, updateCards(el); });
    el.addEventListener('click', (e) => { const c = e.target.closest('[data-cat]'); if (c) board.cat = c.dataset.cat, updateCards(el); });
  }
  const next = list.reduce((m, b) => (!m || Date.parse(b.deadline) < Date.parse(m.deadline) ? b : m), null);
  el.querySelector('.kpis').innerHTML = [['Taking entries', list.length], ['In live pots', money(total)], ['Entries so far', entries.toLocaleString('en-US')]]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('') + (next ? `<div><dt>Next to close</dt><dd>${countdown(next.deadline)}</dd></div>` : '');
  el.querySelector('.chips').innerHTML = cats.map((c) => `<button type="button" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  if (top) el.querySelector('.side').innerHTML = topBuilders(top.items.slice(0, 6));
  updateCards(el);
}

function updateCards(el) {
  if (!SORTS[board.sort]) board.sort = 'soon';
  const q = $q.value.trim().toLowerCase();
  const list = liveBounties().filter((b) => (board.cat === 'All' || b.category === board.cat)
    && (!q || q[0] === '@' || `${b.title} ${b.category} ${b.summary}`.toLowerCase().includes(q))).sort(SORTS[board.sort][1]);
  for (const c of el.querySelectorAll('[data-cat]')) c.setAttribute('aria-pressed', c.dataset.cat === board.cat);
  if (onBoard()) history.replaceState(null, '', board.cat === 'All' && board.sort === 'soon' ? '#/' : `#/?${new URLSearchParams({ cat: board.cat, sort: board.sort })}`);
  el.querySelector('.grid').innerHTML = list.map(bountyCard).join('')
    || notice('No live bounties match', q ? `Nothing matches “${q}”. Clear the search or pick another category.` : 'Every bounty here has closed. New ones open often: check back soon.');
  tickCountdowns();
}

export function bountyCard(b) {
  const fees = Number(b.entryFeesUsd || 0);
  return `<a class="card" href="#/bounty/${encodeURIComponent(b.slug)}">
<div class="meta"><span class="pill">${esc(b.category || 'Bounty')}</span><span>${esc(b.sponsor?.name || '')}</span></div>
<h3>${esc(b.title)}</h3><p class="sum">${esc(b.summary || '')}</p>
<div class="pot"><b>${money(pot(b))}</b> live pot${fees ? ` <em>+${money(fees)} fees</em>` : ''}</div>
<dl class="facts"><div><dt>Time left</dt><dd>${countdown(b.deadline)}</dd></div>
<div><dt>Entry fee</dt><dd class="${b.entryFeeUsd ? 'fee' : ''}">${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</dd></div>
<div><dt>Entries</dt><dd>${(b.submissionCount || 0).toLocaleString('en-US')}</dd></div></dl>
<p class="due">Deadline ${fmtDate(b.deadline)}</p></a>`;
}

const topBuilders = (items) => `<h2>Top builders</h2><ol class="tops">${items.map((u) => `<li><a href="#/u/${encodeURIComponent(u.handle)}">${avatar(u.avatar?.url_small || u.image, u.handle)}<span><b>${esc(u.handle)}</b><small>${u.record.competitions_won} win${u.record.competitions_won === 1 ? '' : 's'} · ${money(u.record.prize_usd)} won</small></span></a></li>`).join('')}</ol><a class="more" href="#/builders">All top builders →</a>`;

// ---- live time ----
export function tickCountdowns() {
  for (const n of document.querySelectorAll('[data-deadline]')) {
    const ms = Date.parse(n.dataset.deadline) - Date.now(), t = timeLeft(ms);
    if (n.firstChild.data !== t) n.firstChild.data = t;
    n.classList.toggle('soon', ms > 0 && ms < 864e5);
  }
}
// Every 60 s the shown view re-reads its data (revalidated) and patches itself in place.
function liveRefresh() {
  if (document.visibilityState === 'visible') route(true);
}
export const countdown = (iso) => `<span class="cd" data-deadline="${esc(iso)}">${timeLeft(Date.parse(iso) - Date.now())}</span>`;
export function timeLeft(ms) {
  if (!(ms > 0)) return 'Closed';
  const s = Math.floor(ms / 1e3), d = Math.floor(s / 86400), p = (n) => String(n).padStart(2, '0');
  return `${d ? d + 'd ' : ''}${p(Math.floor(s / 3600) % 24)}h ${p(Math.floor(s / 60) % 60)}m ${p(s % 60)}s`;
}
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
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : '—');
export const avatar = (url, handle, cls = 'av') => (url
  ? `<img class="${cls}" crossorigin="anonymous" src="${esc(/^https?:/.test(url) ? url : 'https://make.fun' + url)}" alt="" loading="lazy" decoding="async">`
  : `<span class="${cls}" aria-hidden="true">${esc((handle || '?')[0].toUpperCase())}</span>`);
export const crumbs = (...links) => `<nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Bounties</a>${links.map(([t, h]) => ` <span>›</span> ${h ? `<a href="${h}">${esc(t)}</a>` : `<b>${esc(t)}</b>`}`).join('')}</nav>`;
export const notice = (title, text, retry) => `<div class="empty"><h2>${esc(title)}</h2><p>${esc(text)}</p>${retry ? '<button class="btn" type="button" data-retry>Try again</button>' : '<a class="btn" href="#/">Back to bounties</a>'}</div>`;
const renderSkeleton = (a) => `<div class="sk-wrap" aria-busy="true"><div class="sk sk-h"></div>${a ? '<div class="sk sk-panel"></div>' : ''}<div class="sk-grid">${'<div class="sk sk-card"></div>'.repeat(a ? 2 : 6)}</div></div>`;

// ---- state and start ----
const LIVE_MS = 60e3;
const $app = document.getElementById('app');
const $q = document.getElementById('q');
let seq = 0;
let view = null; // { el, path } on screen
const board = { cat: 'All', sort: 'soon', data: null };
const SORTS = { soon: ['Ending soon', (x, y) => Date.parse(x.deadline) - Date.parse(y.deadline)],
  pot: ['Biggest pot', (x, y) => pot(y) - pot(x)], few: ['Fewest entries', (x, y) => x.submissionCount - y.submissionCount] };
const pot = (b) => Number(b.potUsd ?? b.rewardAmount ?? 0);
const onBoard = () => !location.hash.replace(/^#\/?/, '').split('?')[0];
const liveBounties = () => (board.data?.items || []).filter((b) => !b.demo && Date.parse(b.deadline) > Date.now());

document.getElementById('search').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $q.value.trim();
  if (v[0] === '@' && v.length > 1) location.hash = `#/u/${encodeURIComponent(v.slice(1))}`;
  else if (!onBoard()) location.hash = '#/';
});
$q.addEventListener('input', () => { if (onBoard() && view?.el.querySelector('.grid')) updateCards(view.el); });
document.addEventListener('click', (e) => { if (e.target.closest('[data-retry]')) route(); });
addEventListener('hashchange', () => route());
setInterval(tickCountdowns, 1e3);
setInterval(liveRefresh, LIVE_MS);
route();
