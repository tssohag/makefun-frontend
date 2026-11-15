// One cache for every view: TTL'd answers, shared in-flight requests, ETag revalidation (stale on failure).

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

export const API = 'https://make.fun/api';
const TTL = 30e3;
const cache = new Map();
const inflight = new Map();
const enc = encodeURIComponent;
export const getBounties = (f) => cachedFetch('/competitions?status=open&activity=times', f);
export const getBounty = (slug, f) => cachedFetch(`/competitions/${enc(slug)}?submissions=summary`, f);
export const getLeaderboard = (slug, f) => cachedFetch(`/competitions/${enc(slug)}/leaderboard?rows=first`, f);
export const getProfile = (handle, f) => cachedFetch(`/profiles/${enc(handle)}`, f);
export const getTopBuilders = (f) => cachedFetch('/rankings?limit=50', f);
