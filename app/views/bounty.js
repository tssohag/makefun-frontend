// The bounty pane, the helpers the lazy views share, and the after-first-paint wiring: filters, keyboard, theme.
import { esc, money, num, pot, countdown, timeBar, oddsFor, perEntry, paidPlaces, route, view, board, wide, updateRows, markSelected, selectBounty, tickCountdowns } from '../app.js';

function paintDetail(pane, b) {
  const results = b.resolvedAt || b.phases?.at(-1)?.endsAt, opened = b.opensAt || b.publishedAt;
  pane.innerHTML = `<a class="back" href="#/">‹ All bounties</a>
<div class="tags"><span class="pill">${esc(b.category || 'Bounty')}</span> ${statusChip(b)} <span class="muted">by ${esc(b.sponsor?.name || 'make.fun')}</span></div>
<h1>${esc(b.title)}</h1><p class="lead">${esc(b.summary || '')}</p>
<div class="stats"></div><p class="odds"></p><p class="actions"></p>
<dl class="dates">${dateCell('Opened', opened)}${dateCell('Deadline', b.deadline)}${dateCell(b.resolvedAt ? 'Results published' : 'Results by', results)}</dl>
<section class="rewards-box"></section>
<article class="prose"><h2>Description</h2>${md(b.description)}
${b.resolution?.summary ? `<h2>How it is scored</h2><p>${esc(b.resolution.summary)}</p>` : ''}
${b.rules ? `<details><summary>Full rules</summary>${md(b.rules)}</details>` : ''}</article>`;
  patchDetail(pane, b);
}

function patchDetail(pane, b) {
  const n = num(b.submissionCount), fees = Number(b.entryFeesUsd || 0), o = oddsFor(b), lb = `#/bounty/${encodeURIComponent(b.slug)}/leaderboard`;
  pane.querySelector('.stats').innerHTML = `<div class="potbig"><small>Live pot</small><b>${money(pot(b))}</b><em>${fees ? `${money(b.rewardAmount)} reward + ${money(fees)} from ${b.entryFeePayers} entry fees` : 'Reward, paid in USDC'}</em></div>
<div><small>Time left</small><b>${countdown(b.deadline)}</b>${timeBar(b.opensAt || b.publishedAt, b.deadline)}</div>
<div><small>Entry fee</small><b class="${b.entryFeeUsd ? 'fee' : 'free'}">${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</b></div>
<div><small>Entries</small><b><a href="${lb}">${n}</a></b></div>`;
  pane.querySelector('.odds').innerHTML = `<small>Your odds</small> <span><b>${o.per == null ? '—' : perEntry(o.per)}</b> per entry</span>
<span><b>${o.places}</b> paid places</span> <span>${!o.n ? 'no entries yet' : o.n <= o.places ? '<b>every entry</b> paid now' : `<b>1 in ${num(Math.round(o.ratio))}</b> entries paid`}</span>`;
  pane.querySelector('.actions').innerHTML = `<a class="btn" href="https://make.fun/bounty/${encodeURIComponent(b.slug)}" target="_blank" rel="noopener">Enter on make.fun ↗</a>
<a class="btn ghost" href="${lb}">Leaderboard · ${n} entries →</a>`;
  pane.querySelector('.rewards-box').innerHTML = rewardsTable(b);
}

function dateCell(t, iso) {
  return `<div><dt>${t}</dt><dd title="${fmtDate(iso)}">${fmtDate(iso, 1)}</dd></div>`;
}

function statusChip(b) {
  const now = Date.now(), open = b.status === 'open' && Date.parse(b.deadline) > now;
  const [cls, t] = open && Date.parse(b.opensAt || b.publishedAt) > now ? ['soon', 'Opening soon'] : open ? ['ok', 'Taking entries']
    : b.status === 'resolved' ? ['', 'Resolved'] : ['warn', b.status === 'open' ? 'Closed · awaiting results' : b.status];
  return `<span class="chip ${cls}">${esc(t)}</span>`;
}

function rewardsTable(b) {
  const rows = paidPlaces(b), usd = (r) => Number(r.amountUsd);
  const fees = rows.some((r) => Number(r.feeShareUsd) > 0), max = Math.max(...rows.map(usd), 1);
  return `<h2>Rewards <small>${rows.length} paid places · ${money(rows.reduce((s, r) => s + usd(r), 0))} in all</small></h2>${rows.length ? `<table class="tbl rw"><thead><tr><th>Place</th><th class="barcol"></th>${fees ? '<th class="num base">Base</th><th class="num">Fee share</th>' : ''}<th class="num">Pays now</th></tr></thead><tbody>
${rows.map((r) => `<tr><td>${ordinal(r.place)}</td><td class="barcol"><span class="rbar" style="width:${(usd(r) / max * 100).toFixed(1)}%"></span></td>${fees ? `<td class="num muted base">${money(r.baseUsd)}</td><td class="num fs">+${money(r.feeShareUsd)}</td>` : ''}<td class="num"><b>${money(r.amountUsd)}</b></td></tr>`).join('')}</tbody></table>` : '<p class="muted">No prize table published.</p>'}
${b.entryFeeUsd ? '<p class="muted note">The pot grows with every entry fee paid; the fee share is split over the paid places.</p>' : ''}`;
}

function md(src = '') {
  const out = [];
  let list = null, code = null, para = [];
  const endPara = () => { if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`), (para = []); };
  const endList = () => { if (list) out.push(`</${list}>`), (list = null); };
  for (const line of String(src).split('\n')) {
    if (code !== null) { if (line.startsWith('```')) out.push(`<pre><code>${esc(code)}</code></pre>`), (code = null); else code += line + '\n'; continue; }
    const h = /^(#{1,6})\s+(.*)/.exec(line), li = /^\s*([-*]|\d+\.)\s+(.*)/.exec(line);
    if (line.startsWith('```')) endPara(), endList(), (code = '');
    else if (h) { endPara(), endList(); const n = Math.min(h[1].length + 2, 6); out.push(`<h${n}>${inline(h[2])}</h${n}>`); }
    else if (li) {
      endPara();
      const t = /\d/.test(li[1]) ? 'ol' : 'ul';
      if (list !== t) endList(), out.push(`<${t}>`), (list = t);
      out.push(`<li>${inline(li[2])}</li>`);
    } else if (!line.trim()) endPara(), endList();
    else endList(), para.push(line.trim());
  }
  if (code !== null) out.push(`<pre><code>${esc(code)}</code></pre>`);
  endPara(), endList();
  return out.join('');
}
const inline = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g, (_, t, u) => `<a href="${u[0] === '/' ? 'https://make.fun' + u : u}" target="_blank" rel="noopener">${t}</a>`);

const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const fmtDate = (iso, o) => (iso ? new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: o ? undefined : 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : '—');
const imagesDecoded = (el) => Promise.race([Promise.all([...el.querySelectorAll('img')].map((i) => i.decode().catch(() => {}))), new Promise((r) => setTimeout(r, 3e3))]);

const fmtScore = (key, v, d) => (v == null ? '—' : key === 'judge' ? (v / 1e4).toFixed(1) + '%' : d ?? String(v));
const shortDate = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const avatar = (url, handle, cls = 'av') => (url
  ? `<img class="${cls}" crossorigin="anonymous" src="${esc(/^https?:/.test(url) ? url : 'https://make.fun' + url)}" alt="" decoding="async">`
  : `<span class="${cls}" aria-hidden="true">${esc((handle || '?')[0].toUpperCase())}</span>`);
const crumbs = (...links) => `<nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Bounties</a>${links.map(([t, h]) => ` <span>›</span> ${h ? `<a href="${h}">${esc(t)}</a>` : `<b>${esc(t)}</b>`}`).join('')}</nav>`;

function bindKeyboard() {
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

function applyTheme(mode) {
  const root = document.documentElement;
  if (mode) { root.dataset.theme = mode; try { localStorage.theme = mode; } catch {} }
  const dark = root.dataset.theme === 'dark';
  if (dark && !document.querySelector('link[href="dark.min.css"]')) document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="dark.min.css">');
  $theme.setAttribute('aria-pressed', dark);
  $theme.title = `Switch to the ${dark ? 'light' : 'dark'} theme`;
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

function filterChanged() {
  updateRows(view.el);
  if (!location.hash.replace(/^#\/?/, '').split('?')[0]) history.replaceState(null, '', board.cat === 'All' && board.sort === 'soon' ? '#/' : `#/?${new URLSearchParams({ cat: board.cat, sort: board.sort })}`);
}

function focusSearch() {
  scrollTo(0, 0);
  $q.focus();
}

const $q = document.getElementById('q'), $theme = document.getElementById('theme');
const darkScheme = matchMedia('(prefers-color-scheme: dark)');

document.getElementById('search').addEventListener('submit', (e) => {
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
document.addEventListener('change', (e) => { if (e.target.id === 'sort') board.sort = e.target.value, filterChanged(); });
document.addEventListener('click', (e) => {
  const cat = e.target.closest('[data-cat]');
  if (cat) board.cat = cat.dataset.cat, filterChanged();
  else if (e.target.closest('[data-retry]')) route();
  else if (e.target.closest('[data-search]')) focusSearch();
});
$theme.addEventListener('click', () => applyTheme($theme.getAttribute('aria-pressed') === 'true' ? 'light' : 'dark'));
darkScheme.addEventListener('change', () => {
  try { if (localStorage.theme) return; } catch {}
  document.documentElement.dataset.theme = darkScheme.matches ? 'dark' : '';
  applyTheme();
});
wide.addEventListener('change', () => { if (view?.md && !board.sel && wide.matches) selectBounty(view.el, null).then(tickCountdowns); });
applyTheme();
bindKeyboard();

document.head.insertAdjacentHTML('beforeend', `<style>
h2 small,.muted{color:var(--mut);font-weight:400}
.btn.ghost{background:var(--card);color:var(--ac)}
.tbl{width:100%;border-collapse:collapse;font-size:14px}
.tbl th{position:sticky;top:0;background:var(--th);text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);padding:8px 10px;border-bottom:1px solid var(--line)}
.tbl td{padding:8px 10px;border-bottom:1px solid var(--line2);vertical-align:top}
.tbl tbody tr:hover{background:var(--hov)}
.win{color:var(--ok)}
#who{width:100%;font:inherit;color:var(--ink);padding:8px 14px;border:1px solid var(--line);border-radius:99px;background:var(--bg)}
#who:focus{outline:2px solid var(--ac);background:var(--card)}
.panel{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:16px 18px}
.crumbs{font-size:14px;color:var(--mut);margin-bottom:10px}.crumbs span{margin:0 4px}
.av{display:inline-grid;place-items:center;flex:none;width:34px;height:34px;border-radius:50%;object-fit:cover;background:var(--ac2);color:var(--ac);font-weight:700}
.av.xl{width:88px;height:88px;font-size:36px}
.who{display:inline-flex;align-items:center;gap:8px}.who .av{width:26px;height:26px;font-size:13px}
.scroll{overflow:auto;max-height:560px}
.rank{font-weight:700;color:var(--ac)}
.ttl{max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.house td{background:var(--soonbg)}
.head-row{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}
.lb-meta,.count{margin:0;color:var(--mut)}.count{font-size:14px}
.lb-tools{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-bottom:10px}.lb-tools #who{max-width:300px}
.pager{display:flex;justify-content:center;align-items:center;gap:12px;margin-top:12px;font-size:14px}.lb-tools .pager{margin:0 0 0 auto}
.pager button{font:inherit;font-size:14px;font-weight:600;padding:6px 14px;border-radius:99px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}
.pager button:disabled{opacity:.4;cursor:default}
.lb-head{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:18px;align-items:center;margin-bottom:16px;padding:12px 16px}
.lb-head .stats{margin:0}
.places small{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}
.places ol{display:flex;flex-wrap:wrap;gap:6px;list-style:none;margin:6px 0 0;padding:0}
.places li{font-size:13px;padding:3px 10px;border-radius:99px;background:var(--bg);border:1px solid var(--line);font-variant-numeric:tabular-nums}.places li b{color:var(--ac)}
.cols{display:grid;grid-template-columns:1fr 400px;gap:20px;align-items:start}
.profile{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:22px;align-items:center;margin-bottom:16px}.profile h1{margin:0}
.pwho p{margin:2px 0}.bio{max-width:60ch}
.links{display:flex;flex-wrap:wrap;gap:14px;margin:6px 0 0}
.ptotals{display:grid;grid-template-columns:repeat(3,auto);gap:10px 26px;margin:0}
.ptotals dt{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}
.ptotals dd{margin:0;font-size:22px;font-weight:800;font-variant-numeric:tabular-nums}
.gold{color:var(--warn)}
.pays{list-style:none;margin:0;padding:0}.pays li{display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--line2)}
@media (max-width:860px){
.lb :is(th,td):is(:nth-child(3),:nth-child(5),:nth-child(7),:nth-child(8)),.pe :is(th,td):is(:nth-child(2),:nth-child(3)){display:none}
.cols,.lb-head{grid-template-columns:1fr}.ttl{max-width:160px}
.profile{grid-template-columns:auto 1fr}.ptotals{grid-column:1/-1;grid-template-columns:repeat(3,1fr)}.av.xl{width:64px;height:64px}
}
@media (max-width:639px){.pager button,#who{min-height:44px}.tbl td{padding:12px 10px}}
:root{--okbg:#e3f4ea;--warnbg:#fdf0e1;--ink2:#3b3844}
.fee{color:var(--warn)}
.free,.fs{color:var(--ok)}
.pill{display:inline-block;font-size:12px;font-weight:700;padding:2px 10px;border-radius:99px;background:var(--ac2);color:var(--ac)}
.chip{display:inline-block;white-space:nowrap;font-size:12px;font-weight:700;padding:2px 10px;border-radius:99px;background:var(--chip);color:var(--mut)}
.chip.ok{background:var(--okbg);color:var(--ok)}
.chip.warn,.chip.soon{background:var(--warnbg);color:var(--warn)}
.detail h1{font-size:24px;margin:6px 0 2px}
.lead{font-size:14.5px;margin:0 0 12px;color:var(--ink2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.back{display:none;font-weight:600;font-size:14px;margin-bottom:6px}
.tags{display:flex;gap:8px;align-items:center;font-size:13px}
.stats{display:grid;grid-template-columns:1.35fr 1.3fr .8fr .8fr;border:1px solid var(--line);border-radius:12px;margin-bottom:10px}
.stats>div{padding:9px 14px;border-left:1px solid var(--line);min-width:0}
.stats>div:first-child{border-left:0}
.stats small,.dates dt,.odds small{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}
.stats b{display:block;font-size:18px;font-variant-numeric:tabular-nums;white-space:nowrap}
.potbig b{font-size:30px;line-height:1.1;color:var(--ac);letter-spacing:-.03em}
.potbig em{display:block;font-style:normal;font-size:12px;color:var(--mut);line-height:1.3}
.odds{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 18px;margin:0 0 12px;padding:7px 14px;border-radius:10px;background:var(--ac2);font-size:14px;color:var(--ink2)}
.odds small{display:inline;color:var(--ac)}
.odds b{color:var(--ink);font-variant-numeric:tabular-nums}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}
.dates{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 14px;padding:8px 12px;background:var(--bg);border-radius:10px}
.dates dd{margin:0;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}
.rewards-box h2{font-size:16px;margin:0 0 6px}
.rw td,.rw th{padding:2px 8px}
.rw td{vertical-align:middle}
.barcol{width:38%}
.rbar{display:block;height:9px;min-width:3px;border-radius:9px;background:linear-gradient(90deg,var(--ac),#ec6aa0)}
.note{font-size:13px;margin:8px 0 0}
.prose{overflow-wrap:anywhere;margin-top:16px;border-top:1px solid var(--line);padding-top:12px}
.prose h3,.prose h4{margin:18px 0 6px}
.prose pre{background:var(--bg);padding:10px;border-radius:8px;overflow:auto;font-size:13px}
details{margin-top:16px;border-top:1px solid var(--line);padding-top:10px}
summary{cursor:pointer;font-weight:700;color:var(--ac)}
@media (max-width:999px){
.back{display:inline-block}
}
@media (max-width:860px){
.rw .base{display:none}
.rw th{white-space:nowrap}
.stats{grid-template-columns:1fr 1fr}
.stats>div:nth-child(3){border-left:0}
.stats>div:nth-child(n+3){border-top:1px solid var(--line)}
.dates{grid-template-columns:1fr}
}
</style>`);

export { paintDetail, patchDetail, ordinal, fmtDate, imagesDecoded, fmtScore, shortDate, avatar, crumbs };
