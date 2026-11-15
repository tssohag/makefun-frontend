// Routes, API cache, the board; views load by import().
async function route(live) {
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  const [a, b, c] = path.split('/').map(decodeURIComponent);
  if (!a && query) for (const [k, v] of new URLSearchParams(query)) if (k === 'cat' || k === 'sort') board[k] = v;
  const md = !a || (a === 'bounty' && b && !c);
  if (live) return view?.path === path && (view.md ? Promise.all([renderBoard(view.el, true), refreshDetail(view.el)]) : view.run(view.el, true)).then(stamp, () => {});
  window.__shotReady = false;
  for (const n of document.querySelectorAll('#nav a')) n.toggleAttribute('aria-current', n.hash === (a === 'builders' || a === 'u' ? '#/builders' : md ? '#/' : ''));
  const my = ++seq;
  if (md && view?.md && view.el.isConnected) {
    view.path = path;
    await selectBounty(view.el, a ? b : null).catch(() => {});
    return my === seq && ready(view.el, my);
  }
  const run = md ? async (el) => { bountyView(); await renderBoard(el, false); await selectBounty(el, a ? b : null); }
    : a === 'bounty' && b && c === 'leaderboard' ? async (el, l) => (await leaderboardView()).renderLeaderboard(el, b, l)
    : a === 'u' && b ? async (el, l) => (await profileView()).renderProfile(el, b, l)
    : a === 'builders' ? async (el, l) => (await profileView()).renderBuilders(el, l)
    : async (el) => { el.innerHTML = notice('Page not found', 'That address is not a page of this app.'); };
  $app.innerHTML = md ? SKELETON_MD : SKELETON;
  scrollTo(0, 0);
  const el = document.createElement('div');
  el.className = 'view';
  try { await run(el, false); } catch (e) { el.innerHTML = notice('Could not load this page', e.message, true); }
  if (my !== seq) return;
  view = { el, path, run, md: md && !!el.querySelector('.md') };
  $app.replaceChildren(el);
  ready(el, my);
}

function cachedFetch(path, fresh) {
  const hit = cache.get(path);
  if (hit && !fresh && Date.now() - hit.at < 30e3) return Promise.resolve(hit.data);
  if (!inflight.has(path)) inflight.set(path, revalidate(path, hit).finally(() => inflight.delete(path)));
  return inflight.get(path);
}

async function revalidate(path, hit) {
  let res;
  try { res = await fetch(API + path, { cache: 'no-cache', signal: AbortSignal.timeout(20e3) }); } catch (e) {
    if (hit) return hit.data;
    throw e;
  }
  const etag = res.headers.get('ETag');
  if (hit && etag && etag === hit.etag) return (hit.at = Date.now()), hit.data;
  if (!res.ok) throw new Error(res.status === 404 ? 'Not found' : `make.fun answered ${res.status}`);
  const data = await res.json();
  cache.set(path, { data, etag, at: Date.now() });
  return data;
}

async function renderBoard(el, live) {
  const res = await getBounties(live);
  if (live && res === board.data) return;
  board.data = res;
  const { open, soon } = boardGroups();
  const cats = ['All', ...new Set([...open, ...soon].map((b) => b.category).filter(Boolean).sort())];
  if (!cats.includes(board.cat)) board.cat = 'All';
  if (!el.querySelector('.md')) {
    el.innerHTML = `<div class="md"><section class="board" aria-label="Live bounties">
<div class="bhead"><h1>Live bounties</h1><p class="kpi"></p></div>
<div class="tools"><div class="chips" role="group" aria-label="Category"></div>
<label class="sort">Sort <select id="sort">${Object.entries(SORTS).map(([k, [t]]) => `<option value="${k}">${t}</option>`).join('')}</select></label></div>
<div class="btable"><div class="brow bh">${['Bounty', 'Live pot', 'Time left', 'Entries', 'Your odds'].map((t, i) => `<span${i && i !== 2 ? ' class="num"' : ''}>${t}</span>`).join('')}</div><div class="rows"></div></div>
<p class="hint">↑↓ to browse · Enter to open · / to search · L for leaderboard</p>
</section><section class="detail" tabindex="-1" hidden></section></div>`;
  }
  el.querySelector('#sort').value = SORTS[board.sort] ? board.sort : 'soon';
  const total = open.reduce((s, b) => s + pot(b), 0), entries = open.reduce((s, b) => s + (b.submissionCount || 0), 0);
  const next = open.reduce((m, b) => (!m || Date.parse(b.deadline) < Date.parse(m.deadline) ? b : m), null);
  el.querySelector('.kpi').innerHTML = `<b>${open.length}</b> taking entries · <b>${money(total)}</b> in live pots · <b>${num(entries)}</b> entries${next ? ` · next closes in <b>${countdown(next.deadline)}</b>` : ''}`;
  el.querySelector('.chips').innerHTML = cats.map((c) => `<button type="button" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  updateRows(el);
}

async function renderBountyDetail(pane, slug, item, live) {
  const { paintDetail, patchDetail } = await bountyView();
  if (!live && pane.dataset.slug !== slug) {
    pane.dataset.slug = slug;
    shownBounty = null;
    pane.scrollTop = 0;
    if (item) paintDetail(pane, item);
    else pane.innerHTML = '<div class="sk sk-panel"></div>';
  }
  let b;
  try { b = await getBounty(slug, live); } catch (e) {
    if (!item && pane.dataset.slug === slug) pane.innerHTML = notice('Could not load this bounty', e.message, true);
    return;
  }
  if (pane.dataset.slug !== slug || b === shownBounty) return;
  if (live && shownBounty) patchDetail(pane, b); else paintDetail(pane, b);
  shownBounty = b;
}

async function selectBounty(el, slug) {
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

function oddsFor(b) {
  const n = b.submissionCount || 0, places = paidPlaces(b).filter((r) => Number(r.amountUsd) > 0).length;
  const ratio = places ? n / places : Infinity;
  return { n, places, ratio, per: n ? pot(b) / n : null,
    label: !places ? 'no paid places' : !n ? `${places} places paid` : n <= places ? 'all paid' : `1 in ${num(Math.round(ratio))} paid` };
}

function tickCountdowns() {
  const now = Date.now();
  for (const n of document.querySelectorAll('[data-deadline]')) {
    const ms = Date.parse(n.dataset.deadline) - now, t = timeLeft(ms);
    if (n.firstChild.data !== t) n.firstChild.data = t;
    n.classList.toggle('soon', ms > 0 && ms < 864e5);
  }
  for (const n of document.querySelectorAll('.tbar')) n.firstChild.style.width = barWidth(n.dataset.start, n.dataset.end, now);
}

function liveRefresh() {
  if (document.visibilityState === 'visible') route(true);
}

const bountyView = () => import('./views/bounty.js');
const leaderboardView = () => import('./views/leaderboard.js');
const profileView = () => import('./views/profile.js');
const API = 'https://make.fun/api';
const enc = encodeURIComponent;
const getBounties = (f) => cachedFetch('/competitions?status=open&activity=times', f);
const getBounty = (slug, f) => cachedFetch(`/competitions/${enc(slug)}?submissions=summary`, f);

function updateRows(el) {
  if (!SORTS[board.sort]) board.sort = 'soon';
  const q = $q.value.trim().toLowerCase();
  const keep = (b) => (board.cat === 'All' || b.category === board.cat) && (!q || q[0] === '@' || `${b.title} ${b.category} ${b.summary}`.toLowerCase().includes(q));
  const { open, soon } = boardGroups();
  const rows = open.filter(keep).sort(SORTS[board.sort][1]), later = soon.filter(keep);
  for (const c of el.querySelectorAll('[data-cat]')) c.setAttribute('aria-pressed', c.dataset.cat === board.cat);
  el.querySelector('.rows').innerHTML = rows.map((b) => boardRow(b)).join('')
    + (later.length ? `<div class="group"><span>Opening soon · ${later.length}</span></div>${later.map((b) => boardRow(b, true)).join('')}` : '')
    || `<div class="none">${q ? `Nothing matches “${esc(q)}”.` : 'No live bounties in this category right now.'}</div>`;
  markSelected(el);
  tickCountdowns();
}

function boardRow(b, soon) {
  const fee = Number(b.entryFeeUsd || 0), o = oddsFor(b);
  return `<a class="brow" href="#/bounty/${enc(b.slug)}" data-slug="${esc(b.slug)}">
<span class="bt"><b>${esc(b.title)}</b><small><i class="cat">${esc(b.category || 'Bounty')}</i>${esc(b.sponsor?.name || '')}</small></span>
<span class="num pot" data-l="Live pot">${money(pot(b))}<small class="${fee ? 'fee' : 'free'}">${fee ? `${money(fee)} entry` : 'free entry'}</small></span>
<span class="tl" data-l="Time left">${soon ? `<small>opens in</small> ${countdown(b.publishedAt)}` : countdown(b.deadline) + timeBar(b.publishedAt, b.deadline)}</span>
<span class="num" data-l="Entries">${num(b.submissionCount)}</span>
<span class="num od" data-l="Your odds"><b>${o.per == null ? '—' : perEntry(o.per)}</b><small>${o.label}</small></span></a>`;
}

function markSelected(el) {
  for (const r of el.querySelectorAll('.rows .brow')) {
    const on = r.dataset.slug === board.sel;
    r.classList.toggle('sel', on);
    if (on) r.setAttribute('aria-current', 'true'); else r.removeAttribute('aria-current');
  }
}

const paidPlaces = (b) => (b.rewardsNow?.length ? b.rewardsNow
  : Object.entries(b.rewards || {}).map(([place, v]) => ({ place: +place, baseUsd: v, feeShareUsd: 0, amountUsd: v })));

function ready(el, my) {
  document.title = (((board.sel && el.querySelector('.detail:not([hidden]) h1')) || el.querySelector('h1'))?.textContent || 'Bounties') + ' · make.fun';
  stamp();
  tickCountdowns();
  if (my === seq) window.__shotReady = true;
}
const refreshDetail = (el) => board.sel && renderBountyDetail(el.querySelector('.detail'), board.sel, boardItem(board.sel), true);
const stamp = () => { $('live').textContent = `Live · ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`; };
const countdown = (iso) => `<span class="cd" data-deadline="${esc(iso)}">${timeLeft(Date.parse(iso) - Date.now())}</span>`;
function timeLeft(ms) {
  if (!(ms > 0)) return 'Closed';
  const s = Math.floor(ms / 1e3), d = Math.floor(s / 86400), p = (n) => String(n).padStart(2, '0');
  return `${d ? d + 'd ' : ''}${p(Math.floor(s / 3600) % 24)}h ${p(Math.floor(s / 60) % 60)}m ${p(s % 60)}s`;
}
const barWidth = (start, end, now = Date.now()) => `${Math.round(Math.min(1, Math.max(0, (now - Date.parse(start)) / (Date.parse(end) - Date.parse(start) || 1))) * 100)}%`;
const timeBar = (start, end) => (start && end ? `<span class="tbar" data-start="${esc(start)}" data-end="${esc(end)}"><i style="width:${barWidth(start, end)}"></i></span>` : '');
const perEntry = (v) => (v < 0.01 ? '<$0.01' : money(v >= 10 ? Math.round(v) : Math.round(v * 100) / 100));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const num = (n) => (n || 0).toLocaleString('en-US');
const money = (v) => (Number.isFinite(+v) ? '$' + (+v).toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) : '—');
const pot = (b) => Number(b.potUsd ?? b.rewardAmount ?? 0);
const notice = (title, text, retry) => `<div class="empty"><h2>${esc(title)}</h2><p>${esc(text)}</p>${retry ? '<button class="btn" type="button" data-retry>Try again</button>' : '<a class="btn" href="#/">Back to bounties</a>'}</div>`;
const SKELETON_MD = `<div class="md sk-md" aria-busy="true"><div>${'<div class="sk sk-row"></div>'.repeat(10)}</div><div class="sk sk-panel"></div></div>`;
const SKELETON = '<div class="sk sk-panel" aria-busy="true"></div>';
const SORTS = { soon: ['Ending soon', (x, y) => Date.parse(x.deadline) - Date.parse(y.deadline)],
  odds: ['Best odds', (x, y) => oddsFor(x).ratio - oddsFor(y).ratio || pot(y) - pot(x)], pot: ['Biggest pot', (x, y) => pot(y) - pot(x)],
  entries: ['Most entries', (x, y) => y.submissionCount - x.submissionCount], few: ['Fewest entries', (x, y) => x.submissionCount - y.submissionCount] };
function boardGroups(now = Date.now()) {
  const items = (board.data?.items || []).filter((b) => !b.demo && Date.parse(b.deadline) > now);
  return { open: items.filter((b) => !(Date.parse(b.publishedAt) > now)), soon: items.filter((b) => Date.parse(b.publishedAt) > now) };
}
const boardItem = (slug) => board.data?.items.find((b) => b.slug === slug);
const $ = (id) => document.getElementById(id);
const $app = document.querySelector('main'), $q = $('q'), cache = new Map(), inflight = new Map();
const wide = matchMedia('(min-width: 1000px)');
const board = { cat: 'All', sort: 'soon', data: null, sel: null };
let view = null;
let seq = 0, shownBounty = null;

export { route, view, board, wide, updateRows, markSelected, selectBounty, tickCountdowns, cachedFetch, getBounty, paidPlaces, oddsFor,
  esc, notice, money, num, pot, countdown, timeBar, perEntry };

addEventListener('hashchange', () => route());
setInterval(tickCountdowns, 1e3);
setInterval(liveRefresh, 60e3);
route().finally(bountyView);
