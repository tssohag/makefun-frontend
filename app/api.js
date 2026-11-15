// make.fun's public API, read-only GET (CORS open). One in-memory cache for every view:
// an answer lives TTL ms, a request already in flight is shared, and a stale answer is
// revalidated by ETag. make.fun's 304s carry no CORS header, so the browser's HTTP cache
// sends If-None-Match itself (cache: 'no-cache') and serves the 304 as its stored 200; an
// unchanged ETag hands back the cached object unparsed, and views skip their re-render
// when they get the same object. A failed revalidation falls back to the stale answer.

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

export async function revalidate(path, hit) {
  let res;
  try {
    res = await fetch(API + path, { cache: 'no-cache', signal: AbortSignal.timeout(20e3) });
  } catch (e) {
    if (hit) return hit.data;
    throw e;
  }
  const etag = res.headers.get('ETag');
  if (hit && etag && etag === hit.etag) return (hit.at = Date.now()), hit.data;
  if (!res.ok) throw new Error(res.status === 404 ? 'Not found' : `make.fun answered ${res.status}`);
  const data = await res.json();
  cache.set(path, { data, etag, at: Date.now() });
  return data;
}

const enc = encodeURIComponent;
export const getBounties = (f) => cachedFetch('/competitions?status=open&activity=times', f);
export const getBounty = (slug, f) => cachedFetch(`/competitions/${enc(slug)}?submissions=summary`, f);
export const getLeaderboard = (slug, f) => cachedFetch(`/competitions/${enc(slug)}/leaderboard?rows=first`, f);
export const getProfile = (handle, f) => cachedFetch(`/profiles/${enc(handle)}`, f);
export const getTopBuilders = (f) => cachedFetch('/rankings?limit=50', f);
