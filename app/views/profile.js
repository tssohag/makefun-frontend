// #/u/<handle>: avatar, bio, links, record, entries with placings, payouts. #/builders: rankings.
import { getProfile, getTopBuilders } from '../api.js';
import { esc, money, fmtDate, avatar, crumbs } from '../app.js';

let shown = null;

export async function renderProfile(el, handle, live) {
  const p = await getProfile(handle.replace(/^@/, ''), live);
  if (live && p === shown) return;
  shown = p;
  const r = p.record || {}, sols = p.solutions || [], pays = p.payouts || [];
  const links = [p.github_login && [`github.com/${p.github_login}`, `https://github.com/${encodeURIComponent(p.github_login)}`],
    p.x && [`@${p.x.username} on X`, p.x.url], p.discord && [p.discord.username + ' on Discord', p.discord.url],
    p.wallet && [`${p.wallet.address.slice(0, 4)}…${p.wallet.address.slice(-4)}`, p.wallet.explorer_url]].filter(Boolean);
  el.innerHTML = `${crumbs(['@' + p.handle])}
<section class="profile panel">${avatar(p.avatar?.url || p.image, p.handle, 'av xl')}
<div><h1>${esc(p.display_name || p.handle)}</h1><p class="muted">@${esc(p.handle)} · joined ${fmtDate(p.joined_at).split(',').slice(0, 2).join(',')}${p.house ? ' · house account' : ''}</p>
${p.bio ? `<p>${esc(p.bio)}</p>` : ''}<p class="links">${links.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)} ↗</a>`).join('')}</p></div></section>
<section class="tiles">${[['Won', money(r.prize_usd)], ['Entered', r.competitions_entered], ['Placed', r.competitions_placed], ['Wins', r.competitions_won], ['Podiums', r.podium_finishes], ['Best place', r.best_placement ?? '—']]
  .map(([k, v]) => `<div class="tile"><b>${esc(v ?? 0)}</b><small>${k}</small></div>`).join('')}</section>
<div class="cols"><section class="panel"><h2>Entries <small>${sols.length}</small></h2>${sols.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Bounty</th><th>Entry</th><th class="num">Score</th><th class="num">Place</th><th class="num">Prize</th></tr></thead><tbody>
${sols.map((s) => `<tr><td><a href="#/bounty/${encodeURIComponent(s.competition.slug)}">${esc(s.competition.title)}</a><br><small class="muted">${esc(s.competition.category || '')} · ${s.competition.status === 'resolved' ? 'resolved' : 'open'}</small></td>
<td class="ttl">${esc(s.title || '—')}</td><td class="num">${esc(s.score?.display ?? '—')}</td><td class="num">${s.placement ? `<b>#${s.placement}</b>` : '—'}</td><td class="num">${s.prize_usd ? `<b class="win">${money(s.prize_usd)}</b>` : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No public entries yet.</p>'}</section>
<section class="panel"><h2>Winnings <small>${pays.length} payouts</small></h2>${pays.length ? `<ul class="pays">${pays.map((x) => `<li><b class="win">${money(x.amount_usd)}</b> <span>${x.place ? `#${x.place} in ` : ''}<a href="#/bounty/${encodeURIComponent(x.competition.slug)}">${esc(x.competition.title)}</a><br><small class="muted">${fmtDate(x.paid_at)} · <a href="${esc(x.explorer_url)}" target="_blank" rel="noopener">tx ↗</a></small></span></li>`).join('')}</ul>` : '<p class="muted">No payouts yet.</p>'}</section></div>`;
}

export async function renderBuilders(el, live) {
  const res = await getTopBuilders(live);
  el.innerHTML = `${crumbs(['Top builders'])}<h1>Top builders</h1><p class="muted">Ranked by competitions won, then prize money paid. ${res.total ? res.total + ' accounts ranked.' : ''}</p>
<div class="panel scroll"><table class="tbl"><thead><tr><th class="num">Rank</th><th>Builder</th><th class="num">Wins</th><th class="num">Podiums</th><th class="num">Entered</th><th class="num">Won</th></tr></thead><tbody>
${res.items.map((u) => `<tr><td class="num rank">${u.rank}</td><td><a class="who" href="#/u/${encodeURIComponent(u.handle)}">${avatar(u.avatar?.url_small || u.image, u.handle)} @${esc(u.handle)}</a></td><td class="num">${u.record.competitions_won}</td><td class="num">${u.record.podium_finishes}</td><td class="num">${u.record.competitions_entered}</td><td class="num"><b class="win">${money(u.record.prize_usd)}</b></td></tr>`).join('')}</tbody></table></div>`;
}
