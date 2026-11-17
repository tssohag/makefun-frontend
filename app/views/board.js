export { renderBoard, renderBountyDetail, renderTop10, renderActivity, selectBounty, timeline };
// #/ and #/bounty/<slug>: the board (Live / Ended) beside the selected bounty. First paint = 1 request, the
// open-bounties list (board + bounty pane). After the view is ready, in the background: the pane's Leaderboard · Top 10
// (the leaderboard's first rows, so opening the leaderboard next costs none), the board's latest entries (the header
// ticker's cached answer) and, once the dates or rules are in view, the bounty's own record (rules, phases).
// Picking a row repaints the detail pane only; a live refresh patches what changed, in place.
import { getBounties, getBounty, getLeaderboard, activity, background, afterReady, normalizeRows, patchRows, setHTML, oddsFor, paidPlaces, placeRuns, placeLabel, tickCountdowns,
  esc, num, money, pot, countdown, timeBar, perEntry, notice, fmtDate, shortDate, ago, avatar, imagesDecoded, userLink, show } from './shared.js';

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
  const top = live ? renderTop10(pane, slug, true) : void afterReady(() => background(renderTop10(pane, slug)));
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
  if (query !== undefined && readQuery(query)) paintBoard(el);
  if (!slug && wide.matches) slug = el.querySelector('.rows .brow')?.dataset.slug;
  board.sel = slug || null;
  const it = slug && boardItem(slug), ended = it && !(it.status === 'open' && Date.parse(it.deadline) > Date.now());
  if (it && ended !== (board.mode === 'ended')) (board.mode = ended ? 'ended' : 'live'), paintBoard(el);
  const pane = el.querySelector('.detail');
  el.querySelector('.md').classList.toggle('has-sel', location.hash.startsWith('#/bounty/'));
  markSelected(el);
  if (wide.matches && el.isConnected) el.querySelector('.brow.sel')?.scrollIntoView({ block: 'nearest' });
  if (!slug) return void ((pane.hidden = true), (pane.dataset.slug = ''));
  pane.hidden = false;
  if (!wide.matches) scrollTo(0, 0);
  await renderBountyDetail(pane, slug);
}

/** The pane's "Leaderboard · Top 10" (rank, avatar, handle, entry, score with its interval, prize now), a background
 * request after the view is ready (a skeleton until then): the same cached request as the leaderboard view. */
async function renderTop10(pane, slug, live) {
  if (!live) await new Promise((r) => setTimeout(r, 120)); // browsing with ↑↓ skips the boards it only passes over
  if (pane.dataset.slug !== slug) return;
  const lb = await getLeaderboard(slug, live).catch(() => null), box = pane.querySelector('.top10');
  if (!box || pane.dataset.slug !== slug) return;
  box.dataset.slug = slug;
  box.removeAttribute('aria-busy');
  const all = lb ? normalizeRows(lb) : [], ranked = all.filter((r) => r.rank != null), top = ranked.slice(0, 10), b = boardItem(slug) || shown;
  const prizes = b ? paidPlaces(b) : [], col = lb?.columns?.find((c) => c.key === lb.rank_key)?.title || 'Score', href = `#/bounty/${encodeURIComponent(slug)}/leaderboard`;
  const prize = (r) => { const p = r.prize && prizes[r.prize - 1]; return p ? `<b class="win">${money(p.amountUsd)}</b>` : '<span class="muted">—</span>'; };
  setHTML(box, `<div class="t10h"><h2>Leaderboard · Top 10 <small>of ${num(ranked.length)} ranked</small></h2><a class="more" href="${href}">Full leaderboard →</a></div>
${top.length ? `<div class="t10r t10c"><span class="num">#</span><span>Entrant</span><span>Entry</span><span class="num"${top.some((r) => r.ivs) ? ` title="${esc(col)}, with its 90% interval">${esc(col.replace(/^Judge /, ''))} · interval` : `>${esc(col)}`}</span><span class="num">Prize now</span></div>
${top.map((r) => `<div class="t10r"><span class="num rank">${r.rank}</span><span class="who">${avatar(r.image, r.handle)}${userLink(r.handle)}</span><span class="ttl" title="${esc(r.title)}">${esc(r.title || '—')}</span>
<span class="num"><b>${esc(r.score)}</b>${r.ivs ? ` <small>${esc(r.ivs)}</small>` : ''}</span><span class="num">${prize(r)}</span></div>`).join('')}`
    : `<p class="muted">${lb ? 'No ranked entries yet.' : 'Leaderboard unavailable right now.'}</p>`}`);
  await imagesDecoded(box);
}

/** The board's "Latest entries" (who entered what, across make.fun, in the last hour): the header ticker's answer,
 * cached, so it costs no request of its own; it fills the board's column below the rows on a wide screen. */
async function renderActivity(el, a) {
  a ??= await activity();
  const box = el.querySelector('.activity');
  if (!box) return;
  box.removeAttribute('aria-busy');
  setHTML(box, `<h2>Latest entries <small>${a ? `${a.total >= 100 ? '100+' : num(a.total)} in the last hour, across make.fun` : 'unavailable right now'}</small></h2>
<ul>${(a?.entries || []).map((e) => `<li>${avatar(e.image, e.handle)}${userLink(e.handle)} <span>entered <a href="#/bounty/${encodeURIComponent(e.competition.slug)}">${esc(e.competition.title)}</a></span><time>${ago(e.created_at)}</time></li>`).join('')}</ul>`);
  await imagesDecoded(box);
}

function onKey(k, e) {
  const t = e.target;
  if (k === 'Escape') return back(), true;
  if (k === 'e') return setMode(mf.view.el, board.mode === 'live' ? 'ended' : 'live'), true;
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
  const { open, soon, judging } = boardGroups();
  const cats = ['All', ...new Set([...open, ...soon, ...judging].map((b) => b.category).filter(Boolean).sort())];
  if (!cats.includes(board.cat)) board.cat = 'All';
  if (!el.querySelector('.md')) {
    el.innerHTML = `<div class="md"><section class="board" aria-label="Bounties">
<div class="bhead"><h1></h1><div class="seg" role="group" aria-label="Show"></div><p class="kpi"></p></div>
<div class="tools"><div class="chips" role="group" aria-label="Category"></div>
<label class="sort">Sort <select>${Object.entries(SORTS).map(([k, [t]]) => `<option value="${k}">${t}</option>`).join('')}</select></label></div>
<div class="btable"><div class="brow bh">${['Bounty', 'Live pot', 'Time left', 'Entries', 'Your odds'].map((t, i) => `<span${i && i !== 2 ? ' class="num"' : ''}>${t}</span>`).join('')}</div><div class="rows"></div></div>
<p class="hint">↑↓ browse · Enter open · E live/ended · / search · L leaderboard · Esc back</p>
<section class="activity" aria-label="Latest entries" aria-busy="true"><h2>Latest entries</h2><div class="sk"></div></section>
</section><section class="detail" tabindex="-1" hidden></section></div>`;
    el.querySelector('select').addEventListener('change', (e) => { board.sort = e.target.value, filterChanged(el); });
    el.querySelector('.seg').addEventListener('click', (e) => { const c = e.target.closest('[data-mode]'); if (c) setMode(el, c.dataset.mode); });
    el.querySelector('.chips').addEventListener('click', (e) => { const c = e.target.closest('[data-cat]'); if (c) board.cat = c.dataset.cat, filterChanged(el); });
  }
  const total = open.reduce((s, b) => s + pot(b), 0), entries = open.reduce((s, b) => s + (b.submissionCount || 0), 0);
  const next = open.reduce((m, b) => (!m || Date.parse(b.deadline) < Date.parse(m.deadline) ? b : m), null);
  const ended = [...judging, ...boardGroups().resolved], endedPot = ended.reduce((s, b) => s + pot(b), 0);
  setHTML(el.querySelector('.kpi'), board.mode === 'live' ? `<b>${open.length}</b> taking entries · <b>${money(total)}</b> in live pots · <b>${num(entries)}</b> entries${next ? ` · next closes in <b>${countdown(next.deadline)}</b>` : ''}`
    : `<b>${ended.length}</b> ended · <b>${money(endedPot)}</b> in pots · <b>${num(ended.reduce((s, b) => s + (b.submissionCount || 0), 0))}</b> entries · <b>${judging.length}</b> judging, results soon`);
  afterReady(() => background(renderActivity(el)));
  setHTML(el.querySelector('.chips'), cats.map((c) => `<button type="button" data-cat="${esc(c)}">${esc(c)}</button>`).join(''));
  updateRows(el);
}

function updateRows(el) {
  if (!SORTS[board.sort]) board.sort = 'soon';
  el.querySelector('select').value = board.sort;
  const q = document.querySelector('header input').value.trim().toLowerCase();
  const keep = (b) => (board.cat === 'All' || b.category === board.cat) && (!q || q[0] === '@' || `${b.title} ${b.category} ${b.summary}`.toLowerCase().includes(q));
  const { open, soon, judging, resolved } = boardGroups(), by = SORTS[board.sort][1], recent = (x, y) => Date.parse(y.deadline) - Date.parse(x.deadline);
  const rows = open.filter(keep).sort(by), later = soon.filter(keep).sort(by);
  // Ended: past the deadline (judging, results pending), then any resolved; most recent deadline first unless another sort is picked.
  const done = judging.filter(keep).sort(board.sort === 'soon' ? recent : by), paid = resolved.filter(keep).sort(board.sort === 'soon' ? recent : by);
  const live = board.mode === 'live', n = live ? rows.length + later.length : done.length + paid.length;
  el.querySelector('h1').textContent = live ? 'Live bounties' : 'Ended bounties';
  setHTML(el.querySelector('.seg'), [['live', 'Live', rows.length + later.length], ['ended', 'Ended', done.length + paid.length]]
    .map(([m, t, c]) => `<button type="button" data-mode="${m}" aria-pressed="${board.mode === m}">${t} <b>${c}</b></button>`).join(''));
  for (const c of el.querySelectorAll('[data-cat]')) c.setAttribute('aria-pressed', c.dataset.cat === board.cat);
  patchRows(el.querySelector('.rows'), live ? [...rows.map((b) => [b.slug, boardRow(b)]),
    ...(later.length ? [['~soon', `<div class="group"><span>Opening soon · ${later.length}</span></div>`], ...later.map((b) => [b.slug, boardRow(b, true)])] : [])]
    : [...(done.length ? [['~judging', `<div class="group"><span>Judging · results soon · ${done.length}</span></div>`], ...done.map((b) => [b.slug, judgingRow(b)])] : []),
      ...(paid.length ? [['~resolved', `<div class="group done"><span>Resolved · ${paid.length}</span></div>`], ...paid.map((b) => [b.slug, judgingRow(b)])] : []),
      ...(n ? [] : [['~none', `<div class="none">${q ? `Nothing matches “${esc(q)}”.` : `No ${live ? 'live' : 'ended'} bounties in this category right now.`}</div>`]])]);
  markSelected(el);
  tickCountdowns();
}

/** Live ↔ Ended: on a wide screen the pane follows the first row of the list shown when the selection is not in it. */
function setMode(el, mode) {
  if (board.mode === mode) return;
  board.mode = mode;
  paintBoard(el), filterChanged(el);
  const first = el.querySelector('.rows .brow');
  if (!wide.matches || !first || el.querySelector('.rows .brow.sel')) return;
  if (location.hash.startsWith('#/bounty/')) history.replaceState(null, '', first.getAttribute('href')), show();
  else selectBounty(el, null);
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

/** A bounty past its deadline, results pending: the time column says when it closed (or when results are due, if the
 * data has it), the odds column how many places it pays. */
function judgingRow(b) {
  const fee = Number(b.entryFeeUsd || 0), places = oddsFor(b).places, due = b.phases?.at(-1)?.endsAt;
  return `<a class="brow" href="#/bounty/${encodeURIComponent(b.slug)}" data-slug="${esc(b.slug)}">
<span class="bt"><b>${esc(b.title)}</b><small><i class="cat">${esc(b.category || 'Bounty')}</i>${esc(b.sponsor?.name || '')}</small></span>
<span class="num pot" data-l="Live pot">${money(pot(b))}<small class="${fee ? 'fee' : 'free'}">${fee ? `${money(fee)} entry` : 'free entry'}</small></span>
<span class="tl" data-l="Status">${b.status === 'resolved' ? `<small>resolved</small> ${ago(b.resolvedAt || b.deadline)}` : due && Date.parse(due) > Date.now() ? `<small>results by</small> ${shortDate(due)}` : `<small>closed</small> ${ago(b.deadline)}`}</span>
<span class="num" data-l="Entries">${num(b.submissionCount)}</span>
<span class="num od" data-l="Paid places"><b>${places || '—'}</b><small>${places ? `place${places === 1 ? '' : 's'} paid` : 'no paid places'}</small></span></a>`;
}
function markSelected(el) {
  for (const r of el.querySelectorAll('.rows .brow')) {
    const on = r.dataset.slug === board.sel;
    r.classList.toggle('sel', on);
    if (on) r.setAttribute('aria-current', 'true'); else r.removeAttribute('aria-current');
  }
}

function paintDetail(pane, b) {
  const top = pane.querySelector('.top10');
  pane.innerHTML = `<a class="back" href="#/">‹ All bounties</a>
<div class="dh"><h1>${esc(b.title)}</h1><div class="tags"><span class="pill">${esc(b.category || 'Bounty')}</span> ${statusChip(b)} <span class="muted by">by ${esc(b.sponsor?.name || 'make.fun')}</span></div></div><p class="lead">${esc(b.summary || '')}</p>
<div class="stats"></div><div class="oddsrow"><p class="odds"></p><p class="actions"></p></div>
<div class="rw-grid"><section class="rewards-box"></section><section class="when"></section></div>
<section class="top10" aria-label="Leaderboard, top 10" aria-busy="true"><div class="t10h"><h2>Leaderboard · Top 10</h2></div><div class="sk"></div></section>
${b.description ? `<article class="prose"><h2>Description</h2>${md(b.description)}
${b.resolution?.summary ? `<h2>How it is scored</h2><p>${esc(b.resolution.summary)}</p>` : ''}
${'rules' in b && !b.rules ? '' : `<details class="rules"><summary>Full rules</summary>${b.rules ? md(b.rules) : '<p class="muted">Loading the rules…</p>'}</details>`}</article>` : ''}`;
  if (top?.dataset.slug === b.slug) pane.querySelector('.top10').replaceWith(top);
  patchDetail(pane, b);
  if (!('phases' in b)) afterReady(() => pane.dataset.slug === b.slug && lazyRecord(pane, b.slug));
  tickCountdowns();
}

/** The rules and the phases (final judging, results date) are only in the bounty's own record: it is fetched (in the
 * background, after the view is ready) once the dates or the rules come into view, never while ↑↓ only passes over. */
function lazyRecord(pane, slug) {
  const io = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    io.disconnect();
    background(new Promise((r) => setTimeout(r, 120)).then(() => pane.dataset.slug === slug && getBounty(slug).then((d) => fillRecord(pane, slug, d), () => fillRecord(pane, slug, null))));
  });
  for (const n of pane.querySelectorAll('.when, .rules')) io.observe(n);
}

function fillRecord(pane, slug, d) {
  if (pane.dataset.slug !== slug) return;
  const rules = pane.querySelector('.rules');
  if (d) (record = d), setHTML(pane.querySelector('.when'), timeline(d));
  if (!rules) return;
  if (d && !d.rules) rules.remove();
  else rules.innerHTML = `<summary>Full rules</summary>${d ? md(d.rules) : '<p class="muted">The rules are unavailable right now.</p>'}`;
}

/** The dates as a timeline: Opened → the entry phase → Deadline → final judging → Results, with a Now marker where the
 * clock stands. The phases come with the bounty's record; until it is in, the results date shows as pending. */
function timeline(b, now = Date.now()) {
  const ph = b.phases || [], fin = ph.length > 1 ? ph.at(-1) : null, open = b.opensAt || b.publishedAt, dl = b.deadline;
  const res = b.resolvedAt || fin?.endsAt, steps = [['Opened', open], [ph[0]?.title || 'Taking entries', open, dl], ['Deadline', dl],
    [fin && fin.title !== 'Final' ? fin.title : 'Final judging', fin ? fin.startsAt : dl, res], [b.resolvedAt ? 'Results published' : 'Results by', res]];
  const past = (iso) => iso && Date.parse(iso) <= now, nowAt = steps.findIndex((s) => s.length === 2 && !past(s[1]));
  const li = steps.map((s) => (s.length === 3
    ? `<li class="ph${past(s[2]) ? ' past' : past(s[1]) ? ' cur' : ''}"><span>${esc(s[0])}</span><i>${s[1] && s[2] ? span(s[1], s[2]) : ''}</i></li>`
    : `<li class="st${past(s[1]) ? ' past' : ''}"><b>${esc(s[0])}</b><time title="${fmtDate(s[1])}">${s[1] ? dayTime(s[1]) : 'pending'}</time></li>`));
  // Now goes before the first stop still ahead: inside the phase it falls in.
  if (nowAt >= 0) li.splice(nowAt, 0, `<li class="now"><b>Now</b><time>${dayTime(new Date(now).toISOString())}</time></li>`);
  return `<h2>Dates <small>${esc(new Date(now).toLocaleTimeString('en-GB', { timeZoneName: 'short' }).split(' ')[1] || '')}</small></h2><ol class="tline">${li.join('')}</ol>`;
}
const span = (a, z) => { const h = Math.round((Date.parse(z) - Date.parse(a)) / 36e5); return h >= 48 ? `${Math.round(h / 24)} days` : `${h} h`; };
const dayTime = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function patchDetail(pane, b) {
  const n = num(b.submissionCount), fees = Number(b.entryFeesUsd || 0), o = oddsFor(b), lb = `#/bounty/${encodeURIComponent(b.slug)}/leaderboard`;
  setHTML(pane.querySelector('.stats'), `<div class="potbig" title="${fees ? `${money(b.rewardAmount)} reward + ${money(fees)} from ${num(b.entryFeePayers)} entry fees` : 'Reward, paid in USDC'}"><small>Live pot</small><b>${money(pot(b))}</b></div>
<div><small>Time left</small><b>${countdown(b.deadline)}</b>${timeBar(b.opensAt || b.publishedAt, b.deadline)}</div>
<div><small>Entry fee</small><b class="${b.entryFeeUsd ? 'fee' : 'free'}">${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</b></div>
<div><small>Entries</small><b><a href="${lb}">${n}</a></b></div>`);
  setHTML(pane.querySelector('.odds'), `<small>Your odds</small> <span><b>${o.per == null ? '—' : perEntry(o.per)}</b> per entry</span>
<span>${!o.n ? 'no entries yet' : o.n <= o.places ? '<b>every entry</b> paid now' : `<b>1 in ${num(Math.round(o.ratio))}</b> paid`}</span>`);
  setHTML(pane.querySelector('.actions'), `<a class="btn" href="https://make.fun/bounty/${encodeURIComponent(b.slug)}" target="_blank" rel="noopener">Enter on make.fun ↗</a>`);
  setHTML(pane.querySelector('.rewards-box'), rewardsTable(b));
  setHTML(pane.querySelector('.when'), timeline(record?.slug === b.slug ? { ...b, phases: record.phases, resolvedAt: record.resolvedAt } : b));
}

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
  const title = `<h2>Rewards <small>${rows.length} paid</small></h2>`;
  return rows.length ? `<table class="tbl rw"><thead><tr><th colspan="2">${title}</th>${fees ? '<th class="num" title="Every entry fee grows the pot; the fee share is split over the paid places">Fee share</th>' : ''}<th class="num">Pays now</th></tr></thead><tbody>
${runs.map((r) => `<tr><td>${placeLabel(r)}</td><td class="barcol"><span class="rbar" style="width:${(usd(r) / max * 100).toFixed(1)}%"></span></td>${fees ? `<td class="num fs">+${money(r.feeShareUsd)}</td>` : ''}<td class="num"><b>${money(r.amountUsd)}</b>${r.n > 1 ? ' <small>each</small>' : ''}</td></tr>`).join('')}</tbody>
<tfoot><tr><td colspan="${cols - (fees ? 2 : 1)}">Live pot</td>${fees ? `<td class="num fs">+${money(sum('feeShareUsd'))}</td>` : ''}<td class="num"><b>${money(sum('amountUsd'))}</b></td></tr></tfoot></table>` : `${title}<p class="muted">No prize table published.</p>`;
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
  show();
}

function back() {
  if (wide.matches || !board.sel || !location.hash.startsWith('#/bounty/')) return;
  location.hash = '#/';
}

function filterChanged(el) {
  updateRows(el);
  const p = new URLSearchParams([...(board.cat !== 'All' ? [['cat', board.cat]] : []), ...(board.sort !== 'soon' ? [['sort', board.sort]] : []), ...(board.mode !== 'live' ? [['show', board.mode]] : [])]);
  if (!location.hash.replace(/^#\/?/, '').split('?')[0]) history.replaceState(null, '', `#/${p.size ? '?' + p : ''}`);
}

/** Reads ?cat=, ?sort= and ?show=ended from the address; true when they changed the board's filters. */
function readQuery(query) {
  const p = new URLSearchParams(query || ''), cat = p.get('cat') || 'All', sort = p.get('sort') || 'soon', mode = p.get('show') === 'ended' ? 'ended' : 'live';
  const changed = cat !== board.cat || sort !== board.sort || mode !== board.mode;
  if (query || !board.data) (board.cat = cat), (board.sort = sort), (board.mode = mode);
  return query && changed;
}

function boardGroups(now = Date.now()) {
  const all = (board.data?.items || []).filter((b) => !b.demo), items = all.filter((b) => b.status === 'open' && Date.parse(b.deadline) > now);
  return { open: items.filter((b) => !(Date.parse(b.publishedAt) > now)), soon: items.filter((b) => Date.parse(b.publishedAt) > now),
    judging: all.filter((b) => b.status === 'open' && !(Date.parse(b.deadline) > now)), resolved: all.filter((b) => b.status === 'resolved') };
}
const boardItem = (slug) => board.data?.items.find((b) => b.slug === slug);
const SORTS = { soon: ['Ending soon', (x, y) => Date.parse(x.deadline) - Date.parse(y.deadline)],
  odds: ['Best odds', (x, y) => oddsFor(x).ratio - oddsFor(y).ratio || pot(y) - pot(x)], pot: ['Biggest pot', (x, y) => pot(y) - pot(x)],
  entries: ['Most entries', (x, y) => y.submissionCount - x.submissionCount], few: ['Fewest entries', (x, y) => x.submissionCount - y.submissionCount] };
const wide = matchMedia('(min-width: 1000px)');
const board = { cat: 'All', sort: 'soon', mode: 'live', data: null, sel: null };
let shown = null, record = null;

wide.addEventListener('change', () => { const v = mf.view; if (v?.kind === 'board' && !board.sel && wide.matches) selectBounty(v.el, null).then(tickCountdowns); });

const onActivity = (a) => renderActivity(mf.view.el, a);

export { renderBoard as board, onKey, onSearch, onActivity };
