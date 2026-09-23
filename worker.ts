/** Public, anonymous, read-only Docker Hub mirror for the Pages domain. */
interface MirrorEnv {
  DOCKERHUB_USERNAME?: string;
  DOCKERHUB_TOKEN?: string;
}

interface MirrorContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface MirrorDependencies {
  fetch: typeof fetch;
  cache?: Cache;
}

const REGISTRY = 'https://registry-1.docker.io';
const TOKEN_URL = 'https://auth.docker.io/token';
const HUB_API = 'https://hub.docker.com/v2/namespaces';
const MAX_CACHE_BYTES = 512_000_000;
const tokenCache = new Map<string, { token: string; expires: number }>();

class UpstreamError extends Error {
  constructor(
    public status: number,
    public retryAfter: string | null = null,
  ) {
    super(`Docker Hub returned ${status}`);
  }
}

type Target = { kind: 'manifest' | 'blob'; repository: string; reference: string };

function registryResponse(status: number, code: string, message: string, extra?: HeadersInit) {
  return Response.json(
    { errors: [{ code, message }] },
    {
      status,
      headers: {
        'Docker-Distribution-API-Version': 'registry/2.0',
        'Cache-Control': 'no-store',
        ...extra,
      },
    },
  );
}

function parseTarget(path: string): Target | null {
  const match = /^\/v2\/(.+)\/(manifests|blobs)\/([^/]+)$/.exec(path);
  if (!match) return null;
  const [, rawRepository, category, reference] = match;
  const segment = /^[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*$/;
  if (!rawRepository.split('/').every((part) => segment.test(part))) return null;
  const repository = rawRepository.includes('/') ? rawRepository : `library/${rawRepository}`;
  if (category === 'blobs') {
    if (!/^sha256:[a-f0-9]{64}$/.test(reference)) return null;
    return { kind: 'blob', repository, reference };
  }
  if (!/^(?:[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}|sha256:[a-f0-9]{64})$/.test(reference)) return null;
  return { kind: 'manifest', repository, reference };
}

async function getToken(
  repository: string,
  fetcher: typeof fetch,
  env: MirrorEnv,
  force = false,
): Promise<string> {
  const cacheKey = `${env.DOCKERHUB_USERNAME ?? 'anonymous'}:${repository}`;
  const cached = tokenCache.get(cacheKey);
  if (!force && cached && cached.expires > Date.now()) return cached.token;
  const url = new URL(TOKEN_URL);
  url.searchParams.set('service', 'registry.docker.io');
  url.searchParams.set('scope', `repository:${repository}:pull`);
  const headers = new Headers();
  if (env.DOCKERHUB_USERNAME && env.DOCKERHUB_TOKEN)
    headers.set('Authorization', `Basic ${btoa(`${env.DOCKERHUB_USERNAME}:${env.DOCKERHUB_TOKEN}`)}`);
  const response = await fetcher(url, { headers, redirect: 'manual' });
  if (response.status >= 300 && response.status < 400)
    throw new Error('Docker Hub token endpoint redirected');
  if (!response.ok) throw new UpstreamError(response.status, response.headers.get('Retry-After'));
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || !('token' in data) || typeof data.token !== 'string')
    throw new Error('Docker Hub token response is invalid');
  const expiresIn =
    'expires_in' in data && typeof data.expires_in === 'number' ? data.expires_in : 60;
  tokenCache.set(cacheKey, {
    token: data.token,
    expires: Date.now() + Math.max(0, expiresIn - 30) * 1000,
  });
  return data.token;
}

async function fetchRegistry(
  target: Target,
  request: Request,
  fetcher: typeof fetch,
  env: MirrorEnv,
): Promise<Response> {
  const upstream = `${REGISTRY}/v2/${target.repository}/${target.kind === 'blob' ? 'blobs' : 'manifests'}/${target.reference}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getToken(target.repository, fetcher, env, attempt === 1);
    const headers = new Headers({ Authorization: `Bearer ${token}` });
    for (const name of ['Accept', 'Range', 'If-None-Match', 'If-Modified-Since']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    let response = await fetcher(upstream, { method: request.method, headers, redirect: 'manual' });
    let currentURL = upstream;
    if (response.status === 401 && attempt === 0) {
      await response.body?.cancel();
      continue;
    }
    // Hub redirects blobs to signed CDN URLs. Follow server-side so the Docker
    // client never needs to reach the CDN directly or see its temporary URL.
    for (let redirects = 0; [301, 302, 303, 307, 308].includes(response.status); redirects++) {
      if (redirects === 5 || target.kind !== 'blob')
        throw new Error('Unexpected registry redirect');
      const location = response.headers.get('Location');
      if (!location) throw new Error('Registry redirect has no location');
      const next = new URL(location, currentURL);
      if (next.protocol !== 'https:' || next.username || next.password)
        throw new Error('Registry redirect is not HTTPS');
      await response.body?.cancel();
      const cdnHeaders = new Headers();
      const range = request.headers.get('Range');
      if (range) cdnHeaders.set('Range', range);
      response = await fetcher(next, {
        method: request.method,
        headers: cdnHeaders,
        redirect: 'manual',
      });
      currentURL = next.href;
    }
    return response;
  }
  throw new Error('Docker Hub rejected the anonymous token');
}

async function isPublicRepository(
  repository: string,
  origin: string,
  fetcher: typeof fetch,
  cache: Cache | undefined,
  ctx: MirrorContext,
): Promise<boolean> {
  const parts = repository.split('/');
  if (parts.length !== 2) return false;
  const [namespace, name] = parts;
  const key = new Request(`${origin}/_mirror-public/${repository}`, { method: 'GET' });
  if (cache && (await cache.match(key).catch(() => undefined))) return true;

  const response = await fetcher(`${HUB_API}/${namespace}/repositories/${name}`, {
    headers: { Accept: 'application/json' },
    redirect: 'manual',
  });
  if (response.status === 404 || response.status === 403) return false;
  if (response.status === 429)
    throw new UpstreamError(429, response.headers.get('Retry-After'));
  if (!response.ok) throw new UpstreamError(response.status);
  const data: unknown = await response.json();
  const isPublic =
    !!data &&
    typeof data === 'object' &&
    'namespace' in data &&
    data.namespace === namespace &&
    'name' in data &&
    data.name === name &&
    'is_private' in data &&
    data.is_private === false;
  if (isPublic && cache) {
    ctx.waitUntil(
      cache
        .put(key, new Response('public', { headers: { 'Cache-Control': 'public, max-age=60' } }))
        .catch(() => undefined),
    );
  }
  return isPublic;
}

function forward(response: Response, method: string): Response {
  const headers = new Headers();
  for (const name of [
    'Content-Type',
    'Content-Length',
    'Content-Range',
    'Docker-Content-Digest',
    'ETag',
    'Last-Modified',
    'Accept-Ranges',
    'Retry-After',
    'RateLimit-Limit',
    'RateLimit-Remaining',
    'Docker-RateLimit-Source',
  ]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('Docker-Distribution-API-Version', 'registry/2.0');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', 'no-store');
  return new Response(method === 'HEAD' || response.status === 304 ? null : response.body, {
    status: response.status,
    headers,
  });
}

export async function handleRequest(
  request: Request,
  env: MirrorEnv,
  ctx: MirrorContext,
  dependencies: MirrorDependencies,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/v2/' && (request.method === 'GET' || request.method === 'HEAD'))
    return new Response(null, {
      status: 200,
      headers: { 'Docker-Distribution-API-Version': 'registry/2.0' },
    });
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return registryResponse(405, 'UNSUPPORTED', 'This mirror is read-only', { Allow: 'GET, HEAD' });
  // containerd may append the original registry namespace to mirror requests.
  if (url.search && !(url.searchParams.size === 1 && url.searchParams.get('ns') === 'docker.io'))
    return registryResponse(400, 'UNSUPPORTED', 'Query parameters are not supported');
  const target = parseTarget(url.pathname);
  if (!target) return registryResponse(404, 'NAME_UNKNOWN', 'Unsupported registry path');
  if (Boolean(env.DOCKERHUB_USERNAME) !== Boolean(env.DOCKERHUB_TOKEN))
    return registryResponse(503, 'UNAVAILABLE', 'Docker Hub credentials are incomplete');

  try {
    const cache = dependencies.cache;
    // Authenticated tokens can read private repositories. Check visibility
    // anonymously before every request, with a short positive cache.
    if (
      env.DOCKERHUB_USERNAME &&
      !(await isPublicRepository(target.repository, url.origin, dependencies.fetch, cache, ctx))
    )
      return registryResponse(404, 'NAME_UNKNOWN', 'Only public repositories are available');

    // Public blobs are immutable. The synthetic cache request contains no client
    // credentials, and only successful full GET responses are stored.
    const cacheKey = new Request(`${url.origin}${url.pathname}`, { method: 'GET' });
    if (target.kind === 'blob' && cache && !request.headers.has('Range')) {
      const hit = await cache.match(cacheKey).catch(() => undefined);
      if (hit) {
        const result = forward(hit, request.method);
        result.headers.set('X-Mirror-Cache', 'HIT');
        return result;
      }
    }

    const upstream = await fetchRegistry(target, request, dependencies.fetch, env);
    if (upstream.status === 401)
      return registryResponse(404, 'NAME_UNKNOWN', 'Image is unavailable with upstream access');
    const result = forward(upstream, request.method);
    if (target.kind === 'blob' && upstream.ok)
      result.headers.set('Docker-Content-Digest', target.reference);
    result.headers.set('X-Mirror-Cache', 'MISS');
    if (
      cache &&
      target.kind === 'blob' &&
      request.method === 'GET' &&
      upstream.status === 200 &&
      !request.headers.has('Range') &&
      Number(upstream.headers.get('Content-Length')) > 0 &&
      Number(upstream.headers.get('Content-Length')) <= MAX_CACHE_BYTES
    ) {
      const cached = result.clone();
      cached.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      cached.headers.delete('X-Mirror-Cache');
      ctx.waitUntil(cache.put(cacheKey, cached).catch(() => undefined));
    }
    return result;
  } catch (error) {
    if (error instanceof UpstreamError && error.status === 429)
      return registryResponse(
        429,
        'TOOMANYREQUESTS',
        'Docker Hub rate limit reached',
        error.retryAfter ? { 'Retry-After': error.retryAfter } : undefined,
      );
    return registryResponse(502, 'UNAVAILABLE', 'Docker Hub is unavailable from this mirror');
  }
}

export default {
  fetch(request: Request, env: MirrorEnv, ctx: MirrorContext) {
    return handleRequest(request, env, ctx, {
      fetch: globalThis.fetch,
      cache:
        typeof caches === 'undefined'
          ? undefined
          : (caches as CacheStorage & { default: Cache }).default,
    });
  },
};
