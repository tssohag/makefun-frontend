// Shared by every view: countdowns, live refresh, keyboard, theme, search; in-place row patching; formatting; the API
// calls two views share (so the bounty pane's Top 5 and the leaderboard are one cached request).
const { cachedFetch, route, meter } = self.mf;

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
  const p = route(true);
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

const getBounty = (slug, f) => cachedFetch(`/competitions/${encodeURIComponent(slug)}?submissions=summary`, f);
const getLeaderboard = (slug, f) => cachedFetch(`/competitions/${encodeURIComponent(slug)}/leaderboard?rows=first`, f);

/** One flat list of a leaderboard's rows (scored entries, then the rest), each with its formatted score. */
function normalizeRows(lb) {
  if (lb.$rows) return lb.$rows;
  const k = lb.rank_key;
  const row = (r, v, d, valid) => ({ id: r.submission_id, rank: r.rank, prize: r.prize_eligible === false ? null : r.prize_rank, handle: r.handle || '', title: r.title, house: r.house || r.baseline, at: r.received_at,
    score: fmtScore(k, v, d), iv: r.interval ? `${fmtScore(k, +r.interval.low)} – ${fmtScore(k, +r.interval.high)}` : '', valid });
  return (lb.$rows = [...(lb.entries || []).map((e) => row(e, e.values?.[k], e.display?.[k], e.values?.valid ?? +(e.rank != null))),
    ...(lb.rest || []).map((r) => row(r, r.value, r.display, +(r.rank != null)))]);
}

const stamp = () => { document.querySelector('.live').textContent = `Live · ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`; };
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

const $q = document.querySelector('.top input'), $theme = document.querySelector('.theme');
const darkScheme = matchMedia('(prefers-color-scheme: dark)');

/** The meter bar: what the view on screen cost, counted by index.html's cachedFetch and revalidate, and the build's first-load facts. */
function drawMeter(m) {
  const kb = (m.wire + m.json) / 1024, size = `<b>${kb < 10 ? +kb.toFixed(1) : num(Math.round(kb))} KB</b>`, ms = m.ms ? ` · <b>${num(m.ms)} ms</b>` : '';
  setHTML($meter, phone.matches
    ? `<span><b>${m.req}</b> requests · <b>${m.mem}</b> cached · <b>${m.etag}</b> ETag-unchanged · ${size}${ms}</span>`
    : `<span>this view: <b>${m.req}</b> API request${m.req === 1 ? '' : 's'} · <b>${m.mem}</b> from cache · <b>${m.etag}</b> unchanged (ETag) · ${size} ${m.json ? 'JSON' : m.wire ? 'transferred' : 'downloaded'}${m.patched ? ` · <b>${num(m.patched)}</b> row${m.patched === 1 ? '' : 's'} patched` : ''}${m.ms ? ` · ready in <b>${num(m.ms)} ms</b>` : ''}</span><i>${BUILD}</i>`);
}
const BUILD = '1-file first load (2,487 B gzip) · 4 views by import() · ETag cache · rows patched in place · virtual leaderboard';
const phone = matchMedia('(max-width: 639px)');
const $meter = document.querySelector('.meter');

// Wiring, once, when the first view loads.
mf.draw = drawMeter;
mf.ready = () => {
  const v = mf.view?.el, k = mf.view?.kind;
  for (const n of document.querySelectorAll('nav a')) n.toggleAttribute('aria-current', n.hash === (k === 'board' ? '#/' : k === 'profile' || k === 'builders' ? '#/builders' : ''));
  document.title = ((v?.querySelector('.detail:not([hidden]) h1') || v?.querySelector('h1'))?.textContent || 'Bounties') + ' · make.fun';
  stamp();
  tickCountdowns();
};
$q.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $q.value.trim();
  if (v[0] === '@' && v.length > 1) location.hash = `#/u/${encodeURIComponent(v.slice(1))}`;
  else if (mf.view?.kind !== 'board') location.hash = '#/';
});
$q.addEventListener('input', () => mf.view?.mod.onSearch?.());
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-retry]')) route();
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
drawMeter(meter);

export { tickCountdowns, liveRefresh, bindKeyboard, applyTheme, patchRows, setHTML, oddsFor, paidPlaces, getBounty, getLeaderboard, normalizeRows,
  cachedFetch, route, meter, esc, num, money, pot, countdown, timeBar, perEntry, notice, ordinal, fmtDate, shortDate, fmtScore, imagesDecoded, avatar, crumbs, userLink, none };
