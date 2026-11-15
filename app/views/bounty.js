// #/bounty/<slug>: summary, key facts, rewards table with the live pot, description and rules.
// The 60 s refresh re-draws only the facts and rewards boxes, and only when the answer changed.
import { getBounty } from '../api.js';
import { esc, money, fmtDate, countdown, crumbs } from '../app.js';

let shown = null;

export async function renderBounty(el, slug, live) {
  const b = await getBounty(slug, live);
  if (live && b === shown) return;
  shown = b;
  const lb = `#/bounty/${encodeURIComponent(b.slug)}/leaderboard`;
  if (!live || !el.querySelector('.facts-box')) {
    el.innerHTML = `${crumbs([b.title])}
<section class="head"><div><span class="pill">${esc(b.category || 'Bounty')}</span> ${statusChip(b)}
<h1>${esc(b.title)}</h1><p class="lead">${esc(b.summary || '')}</p>
<p class="actions"><a class="btn" href="${lb}">View leaderboard →</a> <a class="btn ghost" href="https://make.fun/bounty/${encodeURIComponent(b.slug)}" target="_blank" rel="noopener">Enter on make.fun ↗</a></p></div>
<aside class="facts-box panel"></aside></section>
<div class="cols"><article class="panel prose"><h2>Description</h2>${md(b.description)}
${b.resolution?.summary ? `<h2>How it is scored</h2><p>${esc(b.resolution.summary)}</p>` : ''}
${b.rules ? `<details><summary>Full rules</summary>${md(b.rules)}</details>` : ''}</article>
<section class="panel rewards-box"></section></div>`;
  }
  el.querySelector('.facts-box').innerHTML = keyFacts(b, lb);
  el.querySelector('.rewards-box').innerHTML = rewardsTable(b);
}

function statusChip(b) {
  const open = b.status === 'open' && Date.parse(b.deadline) > Date.now();
  const [cls, t] = open ? ['ok', 'Taking entries'] : b.status === 'resolved' ? ['', 'Resolved'] : ['warn', b.status === 'open' ? 'Closed · awaiting results' : b.status];
  return `<span class="chip ${cls}">${esc(t)}</span>`;
}

function keyFacts(b, lb) {
  const fees = Number(b.entryFeesUsd || 0);
  return `<div class="big"><small>Live pot</small><b>${money(b.potUsd ?? b.rewardAmount)}</b>${fees ? `<em>${money(b.rewardAmount)} reward + ${money(fees)} from ${b.entryFeePayers} entry fees</em>` : ''}</div>
<dl class="kv"><dt>Time left</dt><dd>${countdown(b.deadline)}</dd>
<dt>Entry fee</dt><dd>${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</dd>
<dt>Entries</dt><dd><a href="${lb}">${(b.submissionCount || 0).toLocaleString('en-US')}</a></dd>
<dt>Opens</dt><dd>${fmtDate(b.opensAt || b.publishedAt)}</dd><dt>Deadline</dt><dd>${fmtDate(b.deadline)}</dd>
<dt>Status</dt><dd>${statusChip(b)}</dd><dt>Sponsor</dt><dd>${esc(b.sponsor?.name || '—')}</dd></dl>`;
}

export function rewardsTable(b) {
  const rows = b.rewardsNow?.length ? b.rewardsNow
    : Object.entries(b.rewards || {}).map(([place, v]) => ({ place: +place, baseUsd: v, feeShareUsd: 0, amountUsd: v }));
  const fees = rows.some((r) => Number(r.feeShareUsd) > 0);
  return `<h2>Rewards <small>${rows.length} paid places</small></h2>${rows.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Place</th>${fees ? '<th>Base</th><th>Fee share</th>' : ''}<th class="num">Pays now</th></tr></thead><tbody>
${rows.map((r) => `<tr><td>${ordinal(r.place)}</td>${fees ? `<td>${money(r.baseUsd)}</td><td>+${money(r.feeShareUsd)}</td>` : ''}<td class="num"><b>${money(r.amountUsd)}</b></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No prize table published.</p>'}
<p class="muted">Total live pot <b>${money(b.potUsd ?? b.rewardAmount)}</b>${b.entryFeeUsd ? ', growing with every entry fee paid' : ''}.</p>`;
}

const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

// A small, safe Markdown subset: everything is escaped first; headings, lists, code, bold, links.
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
