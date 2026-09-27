import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Catch-all proxy to the authoritative realtime/API service.
 *
 * Every /api/* request without a more specific Next.js route is forwarded unchanged.
 * There is deliberately NO fallback data: if the backend is unreachable the client gets a 503,
 * never a fabricated balance, session or result.
 */

const REALTIME_URL = process.env.REALTIME_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Only these headers are forwarded. Sandbox identity headers (x-user-id, x-admin-user-id)
// are intentionally dropped so they can never be injected through the public proxy.
const FORWARDED_HEADERS = ['authorization', 'content-type', 'idempotency-key', 'x-mfa-token', 'x-provider-signature'];

const TIMEOUT_MS = 15000;

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const target = `${REALTIME_URL.replace(/\/$/, '')}/api/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') || 'application/json' }
    });
  } catch {
    return NextResponse.json(
      { success: false, code: 'SERVICE_UNAVAILABLE', message: 'The game service is temporarily unavailable. Please try again shortly.' },
      { status: 503 }
    );
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
