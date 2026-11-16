export { renderBoard, renderBountyDetail, renderTop5, selectBounty };
// #/ and #/bounty/<slug>: the live board beside the selected bounty. First paint = 1 request, the open-bounties list
// (board + bounty pane). After the view is ready, in the background: the pane's Top 5 (the leaderboard's first rows,
// so opening the leaderboard next costs none) and, once the dates or rules are in view, the bounty's own record (rules,
// results date). Picking a row repaints the detail pane only; a live refresh patches what changed, in place.
import { getBounties, getBounty, getLeaderboard, background, afterReady, normalizeRows, patchRows, setHTML, oddsFor, paidPlaces, placeRuns, placeLabel, tickCountdowns,
  esc, num, money, pot, countdown, timeBar, perEntry, notice, fmtDate, userLink } from './shared.js';

async function renderBoard(el, { a, b, query }, live) {
  if (!live) readQuery(query);
  const res = await getBounties(live);
  if (!live || res !== board.data) board.data = res, paintBoard(el);
  if (!live) await selectBounty(el, a ? b : null);
  else if (board.sel) await renderBountyDetail(el.querySelector('.detail'), board.sel, true);
}

/** Paints the pane from the board's own list (no request); only a bounty that is not open any more costs its own. The
 * Top 5 is not part of the first paint: it fills in the background once the view is ready (a live refresh awaits it). */
async function renderBountyDetail(pane, slug, live) {
  let b = boardItem(slug);
  if (!live && pane.dataset.slug !== slug) {
    pane.dataset.slug = slug;
    shown = null;
    pane.scrollTop = 0;
    if (!b) pane.innerHTML = '<div class="sk"></div>';
  }
  const top = live ? renderTop5(pane, slug, true) : void afterReady(() => background(renderTop5(pane, slug)));
  if (!b) {
    try { b = await getBounty(slug, live); } catch (e) {
      if (!shown && pane.dataset.slug === slug) pane.innerHTML = notice('Could not load this bounty', e.message, true);
      return;
    }
    if (pane.dataset.slug !== slug) return;
  }
  if (b !== shown) (live && shown ? patchDetail : paintDetail)(pane, b), (shown = b);
  await top;
}

async function selectBounty(el, slug, query) {
  if (query !== undefined && readQuery(query)) updateRows(el);
  if (!slug && wide.matches) slug = el.querySelector('.rows .brow')?.dataset.slug;
  board.sel = slug || null;
  const pane = el.querySelector('.detail');
  el.querySelector('.md').classList.toggle('has-sel', location.hash.startsWith('#/bounty/'));
  markSelected(el);
  if (wide.matches && el.isConnected) el.querySelector('.brow.sel')?.scrollIntoView({ block: 'nearest' });
  if (!slug) return void (pane.hidden = true, (pane.dataset.slug = ''));
  pane.hidden = false;
  if (!wide.matches) scrollTo(0, 0);
  await renderBountyDetail(pane, slug);
}

/** The pane's "Top 5 now", a background request after the view is ready (a skeleton until then): the same cached
 * request as the leaderboard view, so opening the leaderboard next costs none. */
async function renderTop5(pane, slug, live) {
  if (!live) await new Promise((r) => setTimeout(r, 120)); // browsing with ↑↓ skips the boards it only passes over
  if (pane.dataset.slug !== slug) return;
  const lb = await getLeaderboard(slug, live).catch(() => null), box = pane.querySelector('.top5');
  if (!box || pane.dataset.slug !== slug) return;
  box.dataset.slug = slug;
  box.removeAttribute('aria-busy');
  const all = lb ? normalizeRows(lb) : [], top = all.filter((r) => r.rank != null).slice(0, 5), href = `#/bounty/${encodeURIComponent(slug)}/leaderboard`;
  setHTML(box, `<h2>Top 5 now <small>of ${num(all.length)}</small></h2>${top.length ? `<ol>${top.map((r) => `<li><span class="rank">${r.rank}</span>${userLink(r.handle)}<b>${esc(r.score)}</b></li>`).join('')}</ol>`
    : `<p class="muted">${lb ? 'No ranked entries yet.' : 'Leaderboard unavailable right now.'}</p>`}<a class="more" href="${href}">Full leaderboard →</a>`);
}

function onKey(k, e) {
  const t = e.target;
  if (k === 'Escape') return back(), true;
  if (k === 'l' && board.sel) return (location.hash = `#/bounty/${encodeURIComponent(board.sel)}/leaderboard`), true;
  if (k === 'j' || k === 'k' || ((k === 'ArrowDown' || k === 'ArrowUp') && !t.closest?.('.detail'))) return e.preventDefault(), step(k === 'j' || k === 'ArrowDown' ? 1 : -1), true;
  if (k === 'Enter' && board.sel && !t.closest?.('a,button')) {
    const h = `#/bounty/${encodeURIComponent(board.sel)}`;
    if (location.hash !== h) location.hash = h; else mf.view.el.querySelector('.detail').focus();
    return true;
  }
}

function onSearch() {
  if (!wide.matches && location.hash.startsWith('#/bounty/')) location.hash = '#/';
  updateRows(mf.view.el);
}

function paintBoard(el) {
  const { open, soon } = boardGroups();
  const cats = ['All', ...new Set([...open, ...soon].map((b) => b.category).filter(Boolean).sort())];
  if (!cats.includes(board.cat)) board.cat = 'All';
  if (!el.querySelector('.md')) {
    el.innerHTML = `<div class="md"><section class="board" aria-label="Live bounties">
<div class="bhead"><h1>Live bounties</h1><p class="kpi"></p></div>
<div class="tools"><div class="chips" role="group" aria-label="Category"></div>
<label class="sort">Sort <select>${Object.entries(SORTS).map(([k, [t]]) => `<option value="${k}">${t}</option>`).join('')}</select></label></div>
<div class="btable"><div class="brow bh">${['Bounty', 'Live pot', 'Time left', 'Entries', 'Your odds'].map((t, i) => `<span${i && i !== 2 ? ' class="num"' : ''}>${t}</span>`).join('')}</div><div class="rows"></div></div>
<p class="hint">↑↓ browse · Enter open · / search · L leaderboard · Esc back</p>
</section><section class="detail" tabindex="-1" hidden></section></div>`;
    el.querySelector('select').addEventListener('change', (e) => { board.sort = e.target.value, filterChanged(el); });
    el.querySelector('.chips').addEventListener('click', (e) => { const c = e.target.closest('[data-cat]'); if (c) board.cat = c.dataset.cat, filterChanged(el); });
  }
  const total = open.reduce((s, b) => s + pot(b), 0), entries = open.reduce((s, b) => s + (b.submissionCount || 0), 0);
  const next = open.reduce((m, b) => (!m || Date.parse(b.deadline) < Date.parse(m.deadline) ? b : m), null);
  setHTML(el.querySelector('.kpi'), `<b>${open.length}</b> taking entries · <b>${money(total)}</b> in live pots · <b>${num(entries)}</b> entries${next ? ` · next closes in <b>${countdown(next.deadline)}</b>` : ''}`);
  setHTML(el.querySelector('.chips'), cats.map((c) => `<button type="button" data-cat="${esc(c)}">${esc(c)}</button>`).join(''));
  updateRows(el);
}

function updateRows(el) {
  if (!SORTS[board.sort]) board.sort = 'soon';
  el.querySelector('select').value = board.sort;
  const q = document.querySelector('.top input').value.trim().toLowerCase();
  const keep = (b) => (board.cat === 'All' || b.category === board.cat) && (!q || q[0] === '@' || `${b.title} ${b.category} ${b.summary}`.toLowerCase().includes(q));
  const { open, soon } = boardGroups();
  const rows = open.filter(keep).sort(SORTS[board.sort][1]), later = soon.filter(keep);
  for (const c of el.querySelectorAll('[data-cat]')) c.setAttribute('aria-pressed', c.dataset.cat === board.cat);
  patchRows(el.querySelector('.rows'), [...rows.map((b) => [b.slug, boardRow(b)]),
    ...(later.length ? [['~soon', `<div class="group"><span>Opening soon · ${later.length}</span></div>`], ...later.map((b) => [b.slug, boardRow(b, true)])] : []),
    ...(rows.length + later.length ? [] : [['~none', `<div class="none">${q ? `Nothing matches “${esc(q)}”.` : 'No live bounties in this category right now.'}</div>`]])]);
  markSelected(el);
  tickCountdowns();
}

function boardRow(b, soon) {
  const fee = Number(b.entryFeeUsd || 0), o = oddsFor(b);
  return `<a class="brow" href="#/bounty/${encodeURIComponent(b.slug)}" data-slug="${esc(b.slug)}">
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

function paintDetail(pane, b) {
  const top = pane.querySelector('.top5');
  pane.innerHTML = `<a class="back" href="#/">‹ All bounties</a>
<div class="tags"><span class="pill">${esc(b.category || 'Bounty')}</span> ${statusChip(b)} <span class="muted">by ${esc(b.sponsor?.name || 'make.fun')}</span></div>
<h1>${esc(b.title)}</h1><p class="lead">${esc(b.summary || '')}</p>
<div class="stats"></div><p class="odds"></p><p class="actions"></p>
<dl class="dates">${dates(b)}</dl>
<div class="rw-grid"><section class="rewards-box"></section><section class="top5" aria-label="Top 5 now" aria-busy="true"><h2>Top 5 now</h2><div class="sk"></div></section></div>
${b.description ? `<article class="prose"><h2>Description</h2>${md(b.description)}
${b.resolution?.summary ? `<h2>How it is scored</h2><p>${esc(b.resolution.summary)}</p>` : ''}
${'rules' in b && !b.rules ? '' : `<details class="rules"><summary>Full rules</summary>${b.rules ? md(b.rules) : '<p class="muted">Loading the rules…</p>'}</details>`}</article>` : ''}`;
  if (top?.dataset.slug === b.slug) pane.querySelector('.top5').replaceWith(top);
  patchDetail(pane, b);
  if (!('phases' in b)) afterReady(() => pane.dataset.slug === b.slug && lazyRecord(pane, b.slug));
  tickCountdowns();
}

/** The rules and the results date are only in the bounty's own record: it is fetched (in the background, after the
 * view is ready) once the dates or the rules come into view, never while ↑↓ only passes over a bounty. */
function lazyRecord(pane, slug) {
  const io = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    io.disconnect();
    background(new Promise((r) => setTimeout(r, 120)).then(() => pane.dataset.slug === slug && getBounty(slug).then((d) => fillRecord(pane, slug, d), () => fillRecord(pane, slug, null))));
  });
  for (const n of pane.querySelectorAll('.dates, .rules')) io.observe(n);
}

function fillRecord(pane, slug, d) {
  if (pane.dataset.slug !== slug) return;
  const rules = pane.querySelector('.rules');
  if (d) setHTML(pane.querySelector('.dates'), dates(d));
  if (!rules) return;
  if (d && !d.rules) rules.remove();
  else rules.innerHTML = `<summary>Full rules</summary>${d ? md(d.rules) : '<p class="muted">The rules are unavailable right now.</p>'}`;
}

const dates = (b) => dateCell('Opened', b.opensAt || b.publishedAt) + dateCell('Deadline', b.deadline)
  + dateCell(b.resolvedAt ? 'Results published' : 'Results by', b.resolvedAt || b.phases?.at(-1)?.endsAt);

function patchDetail(pane, b) {
  const n = num(b.submissionCount), fees = Number(b.entryFeesUsd || 0), o = oddsFor(b), lb = `#/bounty/${encodeURIComponent(b.slug)}/leaderboard`;
  setHTML(pane.querySelector('.stats'), `<div class="potbig"><small>Live pot</small><b>${money(pot(b))}</b><em>${fees ? `${money(b.rewardAmount)} reward + ${money(fees)} from ${b.entryFeePayers} entry fees` : 'Reward, paid in USDC'}</em></div>
<div><small>Time left</small><b>${countdown(b.deadline)}</b>${timeBar(b.opensAt || b.publishedAt, b.deadline)}</div>
<div><small>Entry fee</small><b class="${b.entryFeeUsd ? 'fee' : 'free'}">${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</b></div>
<div><small>Entries</small><b><a href="${lb}">${n}</a></b></div>`);
  setHTML(pane.querySelector('.odds'), `<small>Your odds</small> <span><b>${o.per == null ? '—' : perEntry(o.per)}</b> per entry</span>
<span><b>${o.places}</b> paid places</span> <span>${!o.n ? 'no entries yet' : o.n <= o.places ? '<b>every entry</b> paid now' : `<b>1 in ${num(Math.round(o.ratio))}</b> entries paid`}</span>`);
  setHTML(pane.querySelector('.actions'), `<a class="btn" href="https://make.fun/bounty/${encodeURIComponent(b.slug)}" target="_blank" rel="noopener">Enter on make.fun ↗</a>
<a class="btn ghost" href="${lb}">Leaderboard · ${n} entries →</a>`);
  setHTML(pane.querySelector('.rewards-box'), rewardsTable(b));
}

const dateCell = (t, iso) => `<div><dt>${t}</dt><dd title="${fmtDate(iso)}">${fmtDate(iso, 1)}</dd></div>`;

function statusChip(b) {
  const now = Date.now(), open = b.status === 'open' && Date.parse(b.deadline) > now;
  const [cls, t] = open && Date.parse(b.opensAt || b.publishedAt) > now ? ['soon', 'Opening soon'] : open ? ['ok', 'Taking entries']
    : b.status === 'resolved' ? ['', 'Resolved'] : ['warn', b.status === 'open' ? 'Closed · awaiting results' : b.status];
  return `<span class="chip ${cls}">${esc(t)}</span>`;
}

/** The rewards now, consecutive places that pay the same in one row ("4th–10th · $24.84 each"), bars per place, the live pot below. */
function rewardsTable(b) {
  const rows = paidPlaces(b), runs = placeRuns(rows), usd = (r) => Number(r.amountUsd), sum = (k) => Math.round(rows.reduce((s, r) => s + Number(r[k] || 0), 0) * 100) / 100;
  const fees = rows.some((r) => Number(r.feeShareUsd) > 0), max = Math.max(...rows.map(usd), 1), cols = fees ? 4 : 3;
  return `<h2>Rewards <small>${rows.length} paid place${rows.length === 1 ? '' : 's'}</small></h2>${rows.length ? `<table class="tbl rw"><thead><tr><th>Place</th><th class="barcol"></th>${fees ? '<th class="num">Fee share</th>' : ''}<th class="num">Pays now</th></tr></thead><tbody>
${runs.map((r) => `<tr><td>${placeLabel(r)}</td><td class="barcol"><span class="rbar" style="width:${(usd(r) / max * 100).toFixed(1)}%"></span></td>${fees ? `<td class="num fs">+${money(r.feeShareUsd)}</td>` : ''}<td class="num"><b>${money(r.amountUsd)}</b>${r.n > 1 ? ' <small>each</small>' : ''}</td></tr>`).join('')}</tbody>
<tfoot><tr><td colspan="${cols - (fees ? 2 : 1)}">Live pot</td>${fees ? `<td class="num fs">+${money(sum('feeShareUsd'))}</td>` : ''}<td class="num"><b>${money(sum('amountUsd'))}</b></td></tr></tfoot></table>` : '<p class="muted">No prize table published.</p>'}
${b.entryFeeUsd ? '<p class="muted note">Every entry fee grows the pot; the fee share is split over the paid places.</p>' : ''}`;
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

function step(d) {
  const el = mf.view.el, rows = [...el.querySelectorAll('.rows .brow')], i = rows.findIndex((r) => r.dataset.slug === board.sel);
  const r = rows[Math.min(rows.length - 1, Math.max(0, i < 0 ? 0 : i + d))];
  if (!r) return;
  if (!wide.matches) return void (board.sel = r.dataset.slug, markSelected(el), r.scrollIntoView({ block: 'nearest' }));
  history.replaceState(null, '', r.getAttribute('href'));
  mf.route();
}

function back() {
  if (wide.matches || !board.sel || !location.hash.startsWith('#/bounty/')) return;
  location.hash = '#/';
}

function filterChanged(el) {
  updateRows(el);
  if (!location.hash.replace(/^#\/?/, '').split('?')[0]) history.replaceState(null, '', board.cat === 'All' && board.sort === 'soon' ? '#/' : `#/?${new URLSearchParams({ cat: board.cat, sort: board.sort })}`);
}

/** Reads ?cat= and ?sort= from the address; true when they changed the board's filters. */
function readQuery(query) {
  const p = new URLSearchParams(query || ''), cat = p.get('cat') || 'All', sort = p.get('sort') || 'soon', changed = cat !== board.cat || sort !== board.sort;
  if (query || !board.data) board.cat = cat, (board.sort = sort);
  return query && changed;
}

function boardGroups(now = Date.now()) {
  const items = (board.data?.items || []).filter((b) => !b.demo && Date.parse(b.deadline) > now);
  return { open: items.filter((b) => !(Date.parse(b.publishedAt) > now)), soon: items.filter((b) => Date.parse(b.publishedAt) > now) };
}
const boardItem = (slug) => board.data?.items.find((b) => b.slug === slug);
const SORTS = { soon: ['Ending soon', (x, y) => Date.parse(x.deadline) - Date.parse(y.deadline)],
  odds: ['Best odds', (x, y) => oddsFor(x).ratio - oddsFor(y).ratio || pot(y) - pot(x)], pot: ['Biggest pot', (x, y) => pot(y) - pot(x)],
  entries: ['Most entries', (x, y) => y.submissionCount - x.submissionCount], few: ['Fewest entries', (x, y) => x.submissionCount - y.submissionCount] };
const wide = matchMedia('(min-width: 1000px)');
const board = { cat: 'All', sort: 'soon', data: null, sel: null };
let shown = null;

wide.addEventListener('change', () => { const v = mf.view; if (v?.kind === 'board' && !board.sel && wide.matches) selectBounty(v.el, null).then(tickCountdowns); });

export { renderBoard as board, onKey, onSearch };
