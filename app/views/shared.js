// Helpers and styles only the lazy views use (leaderboard, profile, builders), kept out of the first load.
import { esc } from '../app.js';

export const fmtScore = (key, v, d) => (v == null ? '—' : key === 'judge' ? (v / 1e4).toFixed(1) + '%' : d ?? String(v));
export const shortDate = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const avatar = (url, handle, cls = 'av') => (url
  ? `<img class="${cls}" crossorigin="anonymous" src="${esc(/^https?:/.test(url) ? url : 'https://make.fun' + url)}" alt="" decoding="async">`
  : `<span class="${cls}" aria-hidden="true">${esc((handle || '?')[0].toUpperCase())}</span>`);
export const crumbs = (...links) => `<nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Bounties</a>${links.map(([t, h]) => ` <span>›</span> ${h ? `<a href="${h}">${esc(t)}</a>` : `<b>${esc(t)}</b>`}`).join('')}</nav>`;

document.head.insertAdjacentHTML('beforeend', `<style>
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
</style>`);
