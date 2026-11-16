// #/u/<handle>: totals, entries grouped by bounty, on-chain payouts; #/builders: the rankings. One request a view.
import { cachedFetch, esc, money, avatar, crumbs, fmtScore, shortDate, ordinal, fmtDate, imagesDecoded } from './shared.js';

async function renderProfile(el, { b: handle }, live) {
  const p = await getProfile(handle.replace(/^@/, ''), live);
  if (live && p === shown) return;
  shown = p;
  const r = p.record || {}, sols = p.solutions || [], pays = p.payouts || [];
  const links = [p.github_login && [`github.com/${p.github_login}`, `https://github.com/${encodeURIComponent(p.github_login)}`],
    p.x && [`@${p.x.username} on X`, p.x.url], p.discord && [p.discord.username + ' on Discord', p.discord.url],
    p.wallet && [`${p.wallet.address.slice(0, 4)}…${p.wallet.address.slice(-4)}`, p.wallet.explorer_url]].filter(Boolean);
  const rows = entriesByBounty(sols, pays);
  el.innerHTML = `${crumbs(['Top builders', '#/builders'], ['@' + p.handle])}
<section class="profile panel">${avatar(p.avatar?.url || p.image, p.handle, 'av xl')}
<div class="pwho"><h1>${esc(p.display_name || '@' + p.handle)}</h1><p class="muted">@${esc(p.handle)} · joined ${fmtDate(p.joined_at).split(',').slice(0, 2).join(',')}${p.house ? ' · house account' : ''}</p>
<p class="bio${p.bio ? '' : ' muted'}">${esc(p.bio || 'No bio yet.')}</p><p class="links">${links.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)} ↗</a>`).join('')}</p></div>
<dl class="ptotals">${[['Wins', r.competitions_won ?? 0, 'win'], ['Winnings', money(r.prize_usd || 0), 'win'], ['Entries', sols.length.toLocaleString('en-US')], ['Bounties', r.competitions_entered ?? 0], ['Podiums', r.podium_finishes ?? 0], ['Best place', r.best_placement ? ordinal(r.best_placement) : '—']]
  .map(([k, v, c]) => `<div><dt>${k}</dt><dd${c ? ` class="${c}"` : ''}>${esc(v)}</dd></div>`).join('')}</dl></section>
<div class="cols"><section class="panel"><h2>Entries <small>${sols.length} entries in ${rows.length} bounties</small></h2>${rows.length ? `<div class="scroll"><table class="tbl pe"><thead><tr><th>Bounty</th><th class="num">Entries</th><th class="num">Top score</th><th class="num">Place</th><th class="num">Payout</th></tr></thead><tbody>
${rows.map((x) => `<tr><td><a href="#/bounty/${encodeURIComponent(x.c.slug)}">${esc(x.c.title)}</a><br><small class="muted">${esc(x.c.category || '')}${x.c.category ? ' · ' : ''}${x.c.status === 'resolved' ? 'resolved' : Date.parse(x.c.deadline) > Date.now() ? 'taking entries' : 'awaiting results'} · last entry ${shortDate(x.last)}</small></td>
<td class="num">${x.n}</td><td class="num">${esc(x.score)}</td><td class="num">${x.place ? `<b class="${x.place === 1 ? 'gold' : ''}">${ordinal(x.place)}</b>` : '—'}</td><td class="num">${x.payout ? `<b class="win">${money(x.payout)}</b>` : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No public entries yet.</p>'}</section>
<section class="panel"><h2>Payouts <small>${pays.length} paid on chain</small></h2>${pays.length ? `<ul class="pays">${pays.map((x) => `<li><b class="win">${money(x.amount_usd)}</b> <span>${x.place ? `${ordinal(x.place)} in ` : ''}<a href="#/bounty/${encodeURIComponent(x.competition.slug)}">${esc(x.competition.title)}</a><br><small class="muted">${fmtDate(x.paid_at)} · <a href="${esc(x.explorer_url)}" target="_blank" rel="noopener">tx ↗</a></small></span></li>`).join('')}</ul>` : '<p class="muted">No payouts yet.</p>'}</section></div>`;
  await imagesDecoded(el);
}

async function renderBuilders(el, args, live) {
  const res = await getTopBuilders(live);
  if (live && res === builders) return;
  builders = res;
  el.innerHTML = `${crumbs(['Top builders'])}<h1>Top builders</h1><p class="muted">Ranked by competitions won, then prize money paid. ${res.total ? res.total + ' accounts ranked.' : ''}</p>
<div class="panel scroll"><table class="tbl"><thead><tr><th class="num">Rank</th><th>Builder</th><th class="num">Wins</th><th class="num">Podiums</th><th class="num">Entered</th><th class="num">Won</th></tr></thead><tbody>
${res.items.map((u) => `<tr><td class="num rank">${u.rank}</td><td><a class="who" href="#/u/${encodeURIComponent(u.handle)}">${avatar(u.avatar?.url_small || u.image, u.handle)} @${esc(u.handle)}</a></td><td class="num">${u.record.competitions_won}</td><td class="num">${u.record.podium_finishes}</td><td class="num">${u.record.competitions_entered}</td><td class="num"><b class="win">${money(u.record.prize_usd)}</b></td></tr>`).join('')}</tbody></table></div>`;
  await imagesDecoded(el);
}

const getProfile = (handle, f) => cachedFetch(`/profiles/${encodeURIComponent(handle)}`, f);
const getTopBuilders = (f) => cachedFetch('/rankings?limit=50', f);

function entriesByBounty(sols, pays) {
  const by = new Map();
  for (const s of sols) {
    const x = by.get(s.competition.slug) || by.set(s.competition.slug, { c: s.competition, n: 0, place: null, prize: 0, best: null, score: '—', last: null }).get(s.competition.slug);
    x.n++;
    if (s.placement && (!x.place || s.placement < x.place)) x.place = s.placement;
    x.prize = Math.max(x.prize, Number(s.prize_usd || 0));
    if (s.score?.value != null && (x.best == null || s.score.value > x.best)) x.best = s.score.value, (x.score = fmtScore(s.score.column?.key, s.score.value, s.score.display));
    if (!x.last || s.entered_at > x.last) x.last = s.entered_at;
  }
  const paid = new Map();
  for (const y of pays) paid.set(y.competition.slug, (paid.get(y.competition.slug) || 0) + Number(y.amount_usd));
  for (const x of by.values()) x.payout = paid.get(x.c.slug) || x.prize;
  return [...by.values()].sort((a, b) => (b.payout - a.payout) || ((a.place || 1e9) - (b.place || 1e9)) || (b.last > a.last ? 1 : -1));
}

let shown = null, builders = null;

export { renderProfile as profile, renderBuilders as builders, renderProfile, renderBuilders, getProfile, getTopBuilders, entriesByBounty };
