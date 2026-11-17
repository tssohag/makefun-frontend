export { cachedFetch, revalidate, meter };
// Shared by every view: show (index.html's route names the view the hash asks for and its literal import(), show draws
// it), the API cache index.html declares (cachedFetch: 60 s in memory, one request in flight a path; revalidate: ETag)
// and its meter, which show resets and drawMeter draws;
// countdowns, live refresh, keyboard, theme, search; in-place row patching; formatting. The open-bounties list feeds
// the board, the bounty pane and the leaderboard's header, and the bounty pane's Top 5 is the leaderboard's own
// request, so going from a bounty to its leaderboard costs none.
const { route, cachedFetch, revalidate, meter } = mf; // declared by index.html's scripts

function tickCountdowns() {
  const now = Date.now();
  for (const n of document.querySelectorAll('[data-deadline]')) {
    const ms = Date.parse(n.dataset.deadline) - now, t = timeLeft(ms);
    if (n.textContent !== t) n.textContent = t;
    n.classList.toggle('soon', ms > 0 && ms < 864e5);
  }
  for (const n of document.querySelectorAll('.tbar')) n.firstChild.style.width = barWidth(n.dataset.start, n.dataset.end, now);
}

function liveRefresh() {
  if (document.visibilityState !== 'visible') return;
  const p = show(true);
  if (p) p.then(() => (stamp(), tickCountdowns()), () => {});
}

function bindKeyboard() {
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target, typing = /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName);
    if (e.key === 'Escape' && typing) return t.blur();
    if (typing) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === '/') return e.preventDefault(), focusSearch();
    if (mf.view?.mod.onKey?.(k, e)) return;
    if (k === 'Escape') location.hash = '#/';
  });
}

function applyTheme(mode) {
  const root = document.documentElement;
  if (mode) { root.dataset.theme = mode; try { localStorage.theme = mode; } catch {} }
  const dark = root.dataset.theme === 'dark';
  $theme.setAttribute('aria-pressed', dark);
  $theme.title = `Switch to the ${dark ? 'light' : 'dark'} theme`;
}

function oddsFor(b) {
  const n = b.submissionCount || 0, places = paidPlaces(b).filter((r) => Number(r.amountUsd) > 0).length;
  const ratio = places ? n / places : Infinity;
  return { n, places, ratio, per: n ? pot(b) / n : null,
    label: !places ? 'no paid places' : !n ? `${places} places paid` : n <= places ? 'all paid' : `1 in ${num(Math.round(ratio))} paid` };
}
const paidPlaces = (b) => (b.rewardsNow?.length ? b.rewardsNow
  : Object.entries(b.rewards || {}).map(([place, v]) => ({ place: +place, baseUsd: v, feeShareUsd: 0, amountUsd: v })));
/** Consecutive places that pay the same, one run each ({ ...first, to, n }); 1st, 2nd and 3rd always stand alone. */
function placeRuns(rows) {
  const runs = [];
  for (const r of rows) {
    const l = runs.at(-1);
    if (l && r.place > 3 && l.place > 3 && l.to === r.place - 1 && +l.amountUsd === +r.amountUsd && +l.feeShareUsd === +r.feeShareUsd) l.to = r.place, l.n++;
    else runs.push({ ...r, to: r.place, n: 1 });
  }
  return runs;
}
const placeLabel = (r) => ordinal(r.place) + (r.to > r.place ? `–${ordinal(r.to)}` : '');

/** Puts `rows` ([key, html] pairs) in `box` in order, reusing every node whose html is unchanged: only changed rows are replaced. */
function patchRows(box, rows) {
  const old = new Map([...box.children].map((n) => [n.$k, n])), t = document.createElement('template');
  let i = 0;
  for (const [key, html] of rows) {
    let n = old.get(key);
    if (!n || n.$h !== html) {
      t.innerHTML = html;
      const m = t.content.firstElementChild;
      m.$k = key, (m.$h = html);
      if (n) n.replaceWith(m), meter.patched++;
      n = m;
    }
    old.delete(key);
    if (box.children[i] !== n) box.insertBefore(n, box.children[i] || null);
    i++;
  }
  for (const n of old.values()) n.remove();
  meter.show();
}
/** Sets a node's markup only when it changed. */
const setHTML = (n, html) => { if (n.$h !== html) n.innerHTML = n.$h = html; };

/** Every open bounty, each with all the board and the bounty pane show (rewards, pot, fees, description, scoring). */
const getBounties = (f) => cachedFetch('/competitions?status=open&activity=times', f);
/** One bounty's full record: only its rules and phases (the results date) are not in the list, so it loads lazily. */
const getBounty = (slug, f) => cachedFetch(`/competitions/${encodeURIComponent(slug)}?submissions=summary`, f);
/** A bounty from the open list (shared and cached); a bounty that is not open any more costs its own request. */
const bountyFor = async (slug, f) => (await getBounties(f).catch(() => null))?.items.find((b) => b.slug === slug) || getBounty(slug, f);
/** The first rows in full plus every other row in brief (`rest`): the whole board, about a third of `rows=all`'s bytes. */
const getLeaderboard = (slug, f) => cachedFetch(`/competitions/${encodeURIComponent(slug)}/leaderboard?rows=first`, f);
/** Work started after a view is ready (requests the meter counts as background); the screenshot hook waits for it. */
const pending = new Set();
const background = (p) => (pending.add(p), p.finally(() => pending.delete(p)));
/** Runs `fn` once the view on screen is ready (now, if it is), so lazy loads never delay or join the first paint. */
const afterReady = (fn) => (meter.ms ? fn() : later.push(fn));
const later = [];

/** One flat list of a leaderboard's rows (scored entries, then the rest), each with its formatted score. */
function normalizeRows(lb) {
  if (lb.$rows) return lb.$rows;
  const k = lb.rank_key;
  const row = (r, v, d, valid) => ({ id: r.submission_id, rank: r.rank, prize: r.prize_eligible === false ? null : r.prize_rank, handle: r.handle || '', title: r.title, house: r.house || r.baseline, at: r.received_at,
    score: fmtScore(k, v, d), iv: r.interval ? `${fmtScore(k, +r.interval.low)} – ${fmtScore(k, +r.interval.high)}` : '', valid });
  return (lb.$rows = [...(lb.entries || []).map((e) => row(e, e.values?.[k], e.display?.[k], e.values?.valid ?? +(e.rank != null))),
    ...(lb.rest || []).map((r) => row(r, r.value, r.display, +(r.rank != null)))]);
}

const stamp = () => { document.querySelector('#live').textContent = `Live · ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`; };
function timeLeft(ms) {
  if (!(ms > 0)) return 'Closed';
  const s = Math.floor(ms / 1e3), d = Math.floor(s / 86400), p = (n) => String(n).padStart(2, '0');
  return `${d ? d + 'd ' : ''}${p(Math.floor(s / 3600) % 24)}h ${p(Math.floor(s / 60) % 60)}m ${p(s % 60)}s`;
}
// Countdowns and time bars carry no time in their markup (tickCountdowns fills them), so a row's markup changes only with its data.
const countdown = (iso) => `<span class="cd" data-deadline="${esc(iso)}"></span>`;
const barWidth = (start, end, now = Date.now()) => `${Math.round(Math.min(1, Math.max(0, (now - Date.parse(start)) / (Date.parse(end) - Date.parse(start) || 1))) * 100)}%`;
const timeBar = (start, end) => (start && end ? `<span class="tbar" data-start="${esc(start)}" data-end="${esc(end)}"><i></i></span>` : '');
const perEntry = (v) => (v < 0.01 ? '<$0.01' : money(v >= 10 ? Math.round(v) : Math.round(v * 100) / 100));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const num = (n) => (n || 0).toLocaleString('en-US');
const money = (v) => (Number.isFinite(+v) ? '$' + (+v).toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) : '—');
const pot = (b) => Number(b.potUsd ?? b.rewardAmount ?? 0);
const notice = (title, text, retry) => `<div class="empty"><h2>${esc(title)}</h2><p>${esc(text)}</p>${retry ? '<button class="btn" type="button" data-retry>Try again</button>' : '<a class="btn" href="#/">Back to bounties</a>'}</div>`;
const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const fmtDate = (iso, o) => (iso ? new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: o ? undefined : 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : '—');
const shortDate = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtScore = (key, v, d) => (v == null ? '—' : key === 'judge' ? (v / 1e4).toFixed(1) + '%' : d ?? String(v));
const imagesDecoded = (el) => Promise.race([Promise.all([...el.querySelectorAll('img')].map((i) => i.decode().catch(() => {}))), new Promise((r) => setTimeout(r, 3e3))]);
const avatar = (url, handle, cls = 'av') => (url
  ? `<img class="${cls}" crossorigin="anonymous" src="${esc(/^https?:/.test(url) ? url : 'https://make.fun' + url)}" alt="" decoding="async">`
  : `<span class="${cls}" aria-hidden="true">${esc((handle || '?')[0].toUpperCase())}</span>`);
const crumbs = (...links) => `<div class="crumbs" role="navigation" aria-label="Breadcrumb"><a href="#/">Bounties</a>${links.map(([t, h]) => ` <span>›</span> ${h ? `<a href="${h}">${esc(t)}</a>` : `<b>${esc(t)}</b>`}`).join('')}</div>`;
const userLink = (h) => `<a href="#/u/${encodeURIComponent(h)}">@${esc(h)}</a>`;
const none = async (el) => { el.innerHTML = notice('Page not found', 'That address is not a page of this app.'); };
const focusSearch = () => (scrollTo(0, 0), $q.focus());

const $q = document.querySelector('header input'), $theme = document.querySelector('#theme'), $main = document.querySelector('main');
const darkScheme = matchMedia('(prefers-color-scheme: dark)');

/** The meter bar: what the view on screen cost, counted by cachedFetch and revalidate, and the build's first-load facts. */
function drawMeter(m) {
  const kbs = (n) => `<b>${n < 10240 ? +(n / 1024).toFixed(1) : num(Math.round(n / 1024))} KB</b>`, size = kbs(m.wire + m.json), ms = m.ms ? ` · <b>${num(m.ms)} ms</b>` : '';
  setHTML($meter, phone.matches
    ? `<span><b>${m.req}</b> request${m.req === 1 ? '' : 's'} · <b>${m.mem}</b> cached · <b>${m.etag}</b> unchanged · ${size}${ms}${m.bg ? ` · <b>+${m.bg}</b> bg` : ''}</span>`
    : `<span>this view: <b>${m.req}</b> API request${m.req === 1 ? '' : 's'} · <b>${m.mem}</b> from cache · <b>${m.etag}</b> unchanged (ETag) · ${size} ${m.json ? 'JSON' : m.wire ? 'transferred' : 'downloaded'}${m.patched ? ` · <b>${num(m.patched)}</b> row${m.patched === 1 ? '' : 's'} patched` : ''}${m.ms ? ` · ready in <b>${num(m.ms)} ms</b>` : ''}${m.bg ? ` · <b>+${m.bg}</b> background (${kbs(m.bkb)})` : ''}</span><i>${BUILD}</i>`);
}
const BUILD = '1-file first load (2,191 B gzip) · 4 views by import() · ETag cache · virtual leaderboard';
const phone = matchMedia('(max-width: 639px)');
const $meter = document.createElement('footer'); // put on the page with the first view, once the stylesheet is in
$meter.className = 'meter';

/** Draws the view index.html's route names, put on screen only once its module and the stylesheet are in (the skeleton
 * holds its place until then); picking another bounty on the board repaints the detail pane only; live: refreshes the
 * view on screen in place. */
async function show(live) {
  const { path, kind, load, ...args } = route();
  if (live) return view?.path === path && view.run(view.el, args, 1);
  const my = ++seq, el = document.createElement('div');
  meter.reset(my > 1 && performance.now());
  if (kind === 'board' && view?.kind === kind) return (view.path = path), view.mod.selectBounty(view.el, args.a && args.b, args.query).then(() => ready(my));
  document.documentElement.dataset.k = kind, ($main.innerHTML = '<div class=sk>'), scrollTo(0, 0);
  let mod, run;
  try { [mod] = await Promise.all([load(), styled]); await (run = mod[kind])(el, args); }
  catch (e) { el.innerHTML = '<p class=empty><button data-retry>Retry</button>'; el.firstChild.prepend(`Could not load: ${e.message} `); }
  if (my === seq) (view = { el, path, kind, mod, run }), $main.replaceChildren(el), $meter.isConnected || document.body.append($meter), ready(my);
}
const styled = import('./style.js');
let view, seq = 0;
Object.defineProperties(mf, { show: { value: show }, draw: { value: drawMeter }, view: { get: () => view } });

/** The view is on screen: the meter's time to ready, the nav, the title, the Live stamp, then the background work. */
function ready(my) {
  if (my !== seq) return;
  const n = ++readyN;
  meter.ms = Math.round(performance.now() - meter.t0), meter.show();
  for (const fn of later.splice(0)) fn();
  // The screenshot hook waits two frames (lazy loads start when their section is in view) and for the work they start.
  requestAnimationFrame(() => requestAnimationFrame(() => Promise.allSettled(pending).then(() => { if (n === readyN && meter.ms) self.__shotReady = true; })));
  const v = mf.view?.el, k = mf.view?.kind;
  for (const n of document.querySelectorAll('nav a')) n.toggleAttribute('aria-current', n.hash === (k === 'board' ? '#/' : k === 'profile' || k === 'builders' ? '#/builders' : ''));
  document.title = ((v?.querySelector('.detail:not([hidden]) h1') || v?.querySelector('h1'))?.textContent || 'Bounties') + ' · make.fun';
  stamp();
  tickCountdowns();
  return true;
}
let readyN = 0;
$q.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $q.value.trim();
  if (v[0] === '@' && v.length > 1) location.hash = `#/u/${encodeURIComponent(v.slice(1))}`;
  else if (mf.view?.kind !== 'board') location.hash = '#/';
});
$q.addEventListener('input', () => mf.view?.mod.onSearch?.());
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-retry]')) show();
  else if (e.target.closest('[data-search]')) focusSearch();
});
$theme.addEventListener('click', () => applyTheme($theme.getAttribute('aria-pressed') === 'true' ? 'light' : 'dark'));
darkScheme.addEventListener('change', () => {
  try { if (localStorage.theme) return; } catch {}
  document.documentElement.dataset.theme = darkScheme.matches ? 'dark' : '';
  applyTheme();
});
applyTheme();
bindKeyboard();
setInterval(tickCountdowns, 1e3);
setInterval(liveRefresh, 60e3);
onhashchange = () => show();
show();

export { tickCountdowns, liveRefresh, bindKeyboard, applyTheme, patchRows, setHTML, oddsFor, paidPlaces, placeRuns, placeLabel, getBounties, getBounty, bountyFor, getLeaderboard, background, afterReady, normalizeRows,
  show, esc, num, money, pot, countdown, timeBar, perEntry, notice, ordinal, fmtDate, shortDate, fmtScore, imagesDecoded, avatar, crumbs, userLink, none };
