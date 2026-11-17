export { route, cachedFetch, revalidate, meter };
// The app's core, the first module index.html's shell imports: route (the view the hash asks for and its literal
// import()), cachedFetch (API answers kept 60 s in memory, one request in flight a path), revalidate (ETag: an
// unchanged answer keeps the cached copy, a network failure too) and the meter they count into. It starts the view's
// module, the stylesheet and the shared module at once, so they load in parallel.

function route() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?'), [a, b, c] = path.split('/').map(decodeURIComponent);
  const kind = !a || (a === 'bounty' && b && !c) ? 'board' : a === 'bounty' && c === 'leaderboard' ? 'leaderboard' : a === 'u' && b ? 'profile' : a === 'builders' && !b ? 'builders' : 'none';
  return { path, kind, a, b, c, query, load: VIEWS[kind] };
}
const VIEWS = { board: () => import('./board.js'), leaderboard: () => import('./leaderboard.js'), profile: () => import('./profile.js'),
  builders: () => import('./profile.js'), none: () => import('./shared.js') };

/** 60 s memory cache with one request in flight a path; past 60 s (or `fresh`) the answer is revalidated by ETag. */
function cachedFetch(path, fresh) {
  const hit = cache.get(path);
  if ((hit && !fresh && Date.now() - hit.at < 6e4) || inflight.has(path)) return meter.add('mem'), inflight.get(path) || Promise.resolve(hit.data);
  inflight.set(path, revalidate(path, hit).finally(() => inflight.delete(path)));
  return inflight.get(path);
}
const API = 'https://make.fun/api', cache = new Map(), inflight = new Map();

/** Asks the API, letting the browser's HTTP cache send If-None-Match; the same ETag keeps the parsed cached answer. */
async function revalidate(path, hit) {
  meter.add('req');
  let res;
  try { res = await fetch(API + path, { cache: 'no-cache', signal: AbortSignal.timeout(2e4) }); } catch (e) { if (hit) return hit.data; throw e; }
  const etag = res.headers.get('ETag');
  if (hit && etag && etag === hit.etag) return meter.add('etag'), (hit.at = Date.now()), hit.data;
  if (!res.ok) throw Error(res.status === 404 ? 'Not found' : 'HTTP ' + res.status);
  const text = await res.text(), data = JSON.parse(text), t = performance.getEntriesByName(res.url).at(-1)?.transferSize;
  meter.add(t ? 'wire' : 'json', t || text.length);
  cache.set(path, { data, etag, at: Date.now() });
  return data;
}

/** What the view on screen cost: first-paint requests, cache hits, ETag-unchanged answers, bytes, rows patched, time to
 * ready; anything after ready counts as background. shared.js's drawMeter draws it. */
const meter = {
  reset(t0) { self.__shotReady = false; Object.assign(meter, { req: 0, mem: 0, etag: 0, wire: 0, json: 0, bg: 0, bkb: 0, patched: 0, t0: t0 || 0, ms: 0 }).show(); },
  add(k, n = 1) { if (meter.ms && !/m|g/.test(k)) k = k === 'req' ? 'bg' : 'bkb'; meter[k] += n; meter.show(); },
  show() { meter.draw?.(meter); },
};
document.documentElement.dataset.k = route().kind;
meter.reset();
self.mf = { route, cachedFetch, revalidate, meter };

route().load().catch(() => {}), import('./style.js'), import('./shared.js').catch((e) => (document.querySelector('main').textContent = e.message));
