// The bounty detail pane (the page on a phone): painted from the list item, then the full bounty; refresh patches.
import { getBounty } from './api.js';
import { esc, money, num, pot, ordinal, fmtDate, countdown, timeBar, notice, oddsFor, perEntry } from './app.js';

let shown = null;

export async function renderBountyDetail(pane, slug, item, live = false) {
  if (!live && pane.dataset.slug !== slug) {
    pane.dataset.slug = slug;
    shown = null;
    pane.scrollTop = 0;
    if (item) paintDetail(pane, item);
    else pane.innerHTML = '<div class="sk sk-panel"></div>';
  }
  let b;
  try { b = await getBounty(slug, live); } catch (e) {
    if (!item && pane.dataset.slug === slug) pane.innerHTML = notice('Could not load this bounty', e.message, true);
    return;
  }
  if (pane.dataset.slug !== slug || b === shown) return;
  if (live && shown && pane.querySelector('.stats')) patchDetail(pane, b);
  else paintDetail(pane, b);
  shown = b;
}

export function paintDetail(pane, b) {
  const lb = `#/bounty/${encodeURIComponent(b.slug)}/leaderboard`;
  const results = b.resolvedAt || b.phases?.at(-1)?.endsAt;
  pane.innerHTML = `<a class="back" href="#/">‹ All bounties</a>
<div class="tags"><span class="pill">${esc(b.category || 'Bounty')}</span> ${statusChip(b)} <span class="muted">by ${esc(b.sponsor?.name || 'make.fun')}</span></div>
<h1>${esc(b.title)}</h1><p class="lead">${esc(b.summary || '')}</p>
<div class="stats"></div>
<p class="odds"></p>
<p class="actions"></p>
<dl class="dates"><div><dt>Opened</dt><dd title="${fmtDate(b.opensAt || b.publishedAt)}">${fmtDate(b.opensAt || b.publishedAt, 1)}</dd></div><div><dt>Deadline</dt><dd title="${fmtDate(b.deadline)}">${fmtDate(b.deadline, 1)}</dd></div>
<div><dt>${b.resolvedAt ? 'Results published' : 'Results by'}</dt><dd title="${fmtDate(results)}">${fmtDate(results, 1)}</dd></div></dl>
<section class="rewards-box"></section>
<article class="prose"><h2>Description</h2>${md(b.description)}
${b.resolution?.summary ? `<h2>How it is scored</h2><p>${esc(b.resolution.summary)}</p>` : ''}
${b.rules ? `<details><summary>Full rules</summary>${md(b.rules)}</details>` : ''}</article>`;
  patchDetail(pane, b, lb);
}

function patchDetail(pane, b, lb = `#/bounty/${encodeURIComponent(b.slug)}/leaderboard`) {
  const n = num(b.submissionCount), fees = Number(b.entryFeesUsd || 0), o = oddsFor(b);
  pane.querySelector('.stats').innerHTML = `<div class="potbig"><small>Live pot</small><b>${money(pot(b))}</b>${fees ? `<em>${money(b.rewardAmount)} reward + ${money(fees)} from ${b.entryFeePayers} entry fees</em>` : '<em>Reward, paid in USDC</em>'}</div>
<div><small>Time left</small><b>${countdown(b.deadline)}</b>${timeBar(b.opensAt || b.publishedAt, b.deadline)}</div>
<div><small>Entry fee</small><b class="${b.entryFeeUsd ? 'fee' : 'free'}">${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</b></div>
<div><small>Entries</small><b><a href="${lb}">${n}</a></b></div>`;
  pane.querySelector('.odds').innerHTML = `<small>Your odds</small> <span><b>${o.per == null ? '—' : perEntry(o.per)}</b> per entry</span>
<span><b>${o.places}</b> paid places</span> <span>${!o.n ? 'no entries yet' : o.n <= o.places ? '<b>every entry</b> paid now' : `<b>1 in ${num(Math.round(o.ratio))}</b> entries paid`}</span>`;
  pane.querySelector('.actions').innerHTML = `<a class="btn" href="https://make.fun/bounty/${encodeURIComponent(b.slug)}" target="_blank" rel="noopener">Enter on make.fun ↗</a>
<a class="btn ghost" href="${lb}">Leaderboard · ${n} entries →</a>`;
  pane.querySelector('.rewards-box').innerHTML = rewardsTable(b);
}

function statusChip(b) {
  const now = Date.now(), open = b.status === 'open' && Date.parse(b.deadline) > now;
  const [cls, t] = open && Date.parse(b.opensAt || b.publishedAt) > now ? ['soon', 'Opening soon'] : open ? ['ok', 'Taking entries']
    : b.status === 'resolved' ? ['', 'Resolved'] : ['warn', b.status === 'open' ? 'Closed · awaiting results' : b.status];
  return `<span class="chip ${cls}">${esc(t)}</span>`;
}

export function rewardsTable(b) {
  const rows = paidPlaces(b);
  const fees = rows.some((r) => Number(r.feeShareUsd) > 0), max = Math.max(...rows.map((r) => Number(r.amountUsd)), 1);
  return `<h2>Rewards <small>${rows.length} paid places · ${money(rows.reduce((s, r) => s + Number(r.amountUsd), 0))} in all</small></h2>${rows.length ? `<table class="tbl rw"><thead><tr><th>Place</th><th class="barcol"></th>${fees ? '<th class="num base">Base</th><th class="num">Fee share</th>' : ''}<th class="num">Pays now</th></tr></thead><tbody>
${rows.map((r) => `<tr><td>${ordinal(r.place)}</td><td class="barcol"><span class="rbar" style="width:${(Number(r.amountUsd) / max * 100).toFixed(1)}%"></span></td>${fees ? `<td class="num muted base">${money(r.baseUsd)}</td><td class="num fs">+${money(r.feeShareUsd)}</td>` : ''}<td class="num"><b>${money(r.amountUsd)}</b></td></tr>`).join('')}</tbody></table>` : '<p class="muted">No prize table published.</p>'}
${b.entryFeeUsd ? '<p class="muted note">The pot grows with every entry fee paid; the fee share is split over the paid places.</p>' : ''}`;
}

export const paidPlaces = (b) => (b.rewardsNow?.length ? b.rewardsNow
  : Object.entries(b.rewards || {}).map(([place, v]) => ({ place: +place, baseUsd: v, feeShareUsd: 0, amountUsd: v })));

// Safe Markdown subset: escaped first.
export function md(src = '') {
  const out = [];
  let list = null, code = null, para = [];
  const flush = () => { if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`), (para = []); if (list) out.push(`</${list}>`), (list = null); };
  for (const line of String(src).split('\n')) {
    if (code !== null) { if (/^```/.test(line)) out.push(`<pre><code>${esc(code)}</code></pre>`), (code = null); else code += line + '\n'; continue; }
    if (/^```/.test(line)) { flush(); code = ''; continue; }
    const h = /^(#{1,6})\s+(.*)/.exec(line), li = /^\s*([-*]|\d+\.)\s+(.*)/.exec(line);
    if (h) { flush(); out.push(`<h${Math.min(h[1].length + 2, 6)}>${inline(h[2])}</h${Math.min(h[1].length + 2, 6)}>`); }
    else if (li) {
      if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`), (para = []);
      const t = /\d/.test(li[1]) ? 'ol' : 'ul';
      if (list !== t) { if (list) out.push(`</${list}>`); out.push(`<${t}>`); list = t; }
      out.push(`<li>${inline(li[2])}</li>`);
    } else if (!line.trim()) flush();
    else { if (list) out.push(`</${list}>`), (list = null); para.push(line.trim()); }
  }
  if (code !== null) out.push(`<pre><code>${esc(code)}</code></pre>`);
  flush();
  return out.join('');
}
const inline = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g, (_, t, u) => `<a href="${u[0] === '/' ? 'https://make.fun' + u : u}" target="_blank" rel="noopener">${t}</a>`);
