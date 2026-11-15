// make.fun's public API, read-only GET (CORS open). One in-memory cache for every view:
// answers live TTL ms, a request already in flight is shared, and a stale answer is
// revalidated with its ETag (If-None-Match): a 304 reuses the cached object as is, so a
// view can tell "nothing changed" by identity and skip its re-render.

export const API = 'https://make.fun/api';
const TTL = 30e3;
const cache = new Map(); // path -> { data, etag, at }
const inflight = new Map(); // path -> Promise

export function cachedFetch(path, fresh = false) {
  const hit = cache.get(path);
  if (hit && !fresh && Date.now() - hit.at < TTL) return Promise.resolve(hit.data);
  if (!inflight.has(path)) inflight.set(path, revalidate(path, hit).finally(() => inflight.delete(path)));
  return inflight.get(path);
}

async function revalidate(path, hit) {
  const res = await fetch(API + path, { cache: 'no-store', signal: AbortSignal.timeout(20e3), headers: hit?.etag ? { 'If-None-Match': hit.etag } : {} });
  if (res.status === 304 && hit) return (hit.at = Date.now()), hit.data;
  if (!res.ok) throw new Error(res.status === 404 ? 'Not found' : `make.fun answered ${res.status}`);
  const data = await res.json();
  cache.set(path, { data, etag: res.headers.get('ETag'), at: Date.now() });
  return data;
}

const enc = encodeURIComponent;
export const getBounties = (f) => cachedFetch('/competitions?status=open&activity=times', f);
export const getBounty = (slug, f) => cachedFetch(`/competitions/${enc(slug)}?submissions=summary`, f);
export const getLeaderboard = (slug, f) => cachedFetch(`/competitions/${enc(slug)}/leaderboard?rows=first`, f);
export const getProfile = (handle, f) => cachedFetch(`/profiles/${enc(handle)}`, f);
export const getTopBuilders = (f) => cachedFetch('/rankings?limit=50', f);
