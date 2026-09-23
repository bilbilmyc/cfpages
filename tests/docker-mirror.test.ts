import { describe, expect, it, vi } from 'vitest';
import { handleRequest } from '../worker';

const digest = `sha256:${'a'.repeat(64)}`;
const env = {};

function client(path: string, init: RequestInit = {}) {
  return new Request(`https://mirror.example${path}`, {
    ...init,
    headers: { ...init.headers },
  });
}

function context() {
  const pending: Promise<unknown>[] = [];
  return {
    pending,
    waitUntil: (promise: Promise<unknown>) => {
      pending.push(promise);
    },
  };
}

function hub(handler: (url: URL, init?: RequestInit) => Response | Promise<Response>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === 'auth.docker.io') {
      expect(init?.redirect).toBe('manual');
      return Response.json({ token: 'public-token', expires_in: 300 });
    }
    return handler(url, init);
  }) as typeof fetch;
}

describe('Docker Hub mirror', () => {
  it('serves the public registry probe without contacting Docker Hub', async () => {
    const fetcher = hub(() => {
      throw new Error('Unexpected upstream request');
    });
    const ctx = context();
    const probe = await handleRequest(client('/v2/'), env, ctx, { fetch: fetcher });
    expect(probe.status).toBe(200);
    expect(probe.headers.get('Docker-Distribution-API-Version')).toBe('registry/2.0');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('forwards manifest Accept and digest, and never forwards client credentials', async () => {
    const fetcher = hub((url, init) => {
      expect(url.pathname).toBe('/v2/library/busybox/manifests/latest');
      const headers = new Headers(init?.headers);
      expect(headers.get('Accept')).toContain('application/vnd.oci.image.index.v1+json');
      expect(headers.get('Authorization')).toBe('Bearer public-token');
      return new Response('{}', {
        headers: {
          'Content-Type': 'application/vnd.oci.image.index.v1+json',
          'Docker-Content-Digest': digest,
        },
      });
    });
    const response = await handleRequest(
      client('/v2/busybox/manifests/latest', {
        headers: {
          Accept: 'application/vnd.oci.image.index.v1+json',
          Authorization: 'Basic should-not-leak',
        },
      }),
      env,
      context(),
      { fetch: fetcher },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Docker-Content-Digest')).toBe(digest);
    expect(await response.text()).toBe('{}');
    const withNamespace = await handleRequest(
      client('/v2/busybox/manifests/latest?ns=docker.io', {
        headers: { Accept: 'application/vnd.oci.image.index.v1+json' },
      }),
      env,
      context(),
      { fetch: fetcher },
    );
    expect(withNamespace.status).toBe(200);
  });

  it('follows blob redirects within the Worker and caches full immutable blobs', async () => {
    const calls: string[] = [];
    const fetcher = hub((url, init) => {
      calls.push(url.href);
      if (url.hostname === 'registry-1.docker.io')
        return new Response(null, {
          status: 307,
          headers: { Location: 'https://cdn.example/blob' },
        });
      expect(new Headers(init?.headers).has('Authorization')).toBe(false);
      return new Response('blob-data', {
        headers: { 'Content-Length': '9', 'Docker-Content-Digest': digest },
      });
    });
    let stored: Response | undefined;
    const cache = {
      match: vi.fn(async () => stored?.clone()),
      put: vi.fn(async (_request: Request, response: Response) => {
        stored = response.clone();
      }),
    } as unknown as Cache;
    const ctx = context();
    const path = `/v2/library/busybox/blobs/${digest}`;
    const miss = await handleRequest(client(path), env, ctx, { fetch: fetcher, cache });
    expect(miss.status).toBe(200);
    expect(miss.headers.get('X-Mirror-Cache')).toBe('MISS');
    expect(await miss.text()).toBe('blob-data');
    await Promise.all(ctx.pending);
    const hit = await handleRequest(client(path), env, context(), { fetch: fetcher, cache });
    expect(hit.headers.get('X-Mirror-Cache')).toBe('HIT');
    expect(await hit.text()).toBe('blob-data');
    expect(calls).toHaveLength(2);
  });

  it('passes Range to the CDN without caching a partial response', async () => {
    const fetcher = hub((url, init) => {
      if (url.hostname === 'registry-1.docker.io')
        return new Response(null, {
          status: 307,
          headers: { Location: 'https://cdn.example/blob' },
        });
      expect(new Headers(init?.headers).get('Range')).toBe('bytes=2-4');
      return new Response('ob-', { status: 206, headers: { 'Content-Range': 'bytes 2-4/9' } });
    });
    const cache = { match: vi.fn(), put: vi.fn() } as unknown as Cache;
    const result = await handleRequest(
      client(`/v2/busybox/blobs/${digest}`, {
        headers: { Range: 'bytes=2-4' },
      }),
      env,
      context(),
      { fetch: fetcher, cache },
    );
    expect(result.status).toBe(206);
    expect(result.headers.get('Content-Range')).toBe('bytes 2-4/9');
    expect(cache.match).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('preserves HEAD semantics through a blob CDN redirect', async () => {
    const fetcher = hub((url, init) => {
      expect(init?.method).toBe('HEAD');
      if (url.hostname === 'registry-1.docker.io')
        return new Response(null, {
          status: 307,
          headers: { Location: 'https://cdn.example/blob' },
        });
      return new Response(null, { headers: { 'Content-Length': '1234' } });
    });
    const response = await handleRequest(
      client(`/v2/busybox/blobs/${digest}`, { method: 'HEAD' }),
      env,
      context(),
      { fetch: fetcher },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Length')).toBe('1234');
    expect(response.headers.get('Docker-Content-Digest')).toBe(digest);
    expect(response.body).toBeNull();
  });

  it('uses an upstream secret only after checking that a repository is public', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.hostname === 'hub.docker.com')
        return Response.json({ namespace: 'library', name: 'testpublic', is_private: false });
      if (url.hostname === 'auth.docker.io') {
        expect(new Headers(init?.headers).get('Authorization')).toBe(
          `Basic ${btoa('mirror-user:test-secret')}`,
        );
        return Response.json({ token: 'account-token', expires_in: 300 });
      }
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer account-token');
      return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    const response = await handleRequest(
      client('/v2/library/testpublic/manifests/latest', {
        headers: { Authorization: 'Basic client-secret' },
      }),
      { DOCKERHUB_USERNAME: 'mirror-user', DOCKERHUB_TOKEN: 'test-secret' },
      context(),
      { fetch: fetcher },
    );
    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('does not use account access to expose private repositories', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ namespace: 'library', name: 'testprivate', is_private: true }),
    ) as typeof fetch;
    const response = await handleRequest(
      client('/v2/library/testprivate/manifests/latest'),
      { DOCKERHUB_USERNAME: 'mirror-user', DOCKERHUB_TOKEN: 'test-secret' },
      context(),
      { fetch: fetcher },
    );
    expect(response.status).toBe(404);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const incomplete = await handleRequest(
      client('/v2/library/testprivate/manifests/latest'),
      { DOCKERHUB_USERNAME: 'mirror-user' },
      context(),
      { fetch: fetcher },
    );
    expect(incomplete.status).toBe(503);
  });

  it('rejects writes, unknown routes, queries, and invalid repository paths', async () => {
    const fetcher = hub(() => {
      throw new Error('Unexpected upstream request');
    });
    const ctx = context();
    expect(
      (
        await handleRequest(
          client('/v2/busybox/blobs/uploads/', { method: 'POST' }),
          env,
          ctx,
          { fetch: fetcher },
        )
      ).status,
    ).toBe(405);
    expect(
      (await handleRequest(client('/v2/busybox/tags/list'), env, ctx, { fetch: fetcher }))
        .status,
    ).toBe(404);
    expect(
      (
        await handleRequest(client('/v2/busybox/manifests/latest?x=1'), env, ctx, {
          fetch: fetcher,
        })
      ).status,
    ).toBe(400);
    expect(
      (await handleRequest(client('/v2/%2e%2e/manifests/latest'), env, ctx, { fetch: fetcher }))
        .status,
    ).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
