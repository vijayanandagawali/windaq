import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Catch-all proxy to the authoritative realtime/API service.
 *
 * Every /api/* request without a more specific Next.js route is forwarded unchanged, with two
 * security responsibilities:
 *
 * 1. Session cookie — the backend's session token is kept in an httpOnly cookie that page scripts
 *    cannot read. Login responses have the token stripped from the body and stored in the cookie;
 *    every forwarded request gets it back as `Authorization: Bearer …`. Client-supplied
 *    Authorization headers are ignored.
 * 2. CSRF — state-changing requests must come from this site (Origin/Referer check). Combined with
 *    SameSite=Lax this blocks cross-site form posts and fetches.
 *
 * There is deliberately NO fallback data: if the backend is unreachable the client gets a 503,
 * never a fabricated balance, session or result.
 */

const REALTIME_URL = process.env.REALTIME_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const SESSION_COOKIE = 'windaq_session';
const SESSION_ISSUING_PATHS = new Set(['auth/login', 'auth/register', 'auth/guest']);
const SESSION_ENDING_PATHS = new Set(['auth/logout', 'auth/logout-all']);

// Only these headers are forwarded. Sandbox identity headers (x-user-id, x-admin-user-id) and any
// client Authorization header are intentionally dropped.
const FORWARDED_HEADERS = ['content-type', 'idempotency-key', 'x-mfa-token', 'x-provider-signature', 'user-agent'];
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const TIMEOUT_MS = 15000;

function isSameOrigin(request: NextRequest): boolean {
  const expectedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const source = request.headers.get('origin') || request.headers.get('referer');
  // Server-to-server callers (e.g. payment webhooks) send neither header.
  if (!source) return true;
  try {
    return new URL(source).host === expectedHost;
  } catch {
    return false;
  }
}

function sessionCookieOptions(request: NextRequest, maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds
  };
}

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ success: false, code, message }, { status });
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const route = path.join('/');

  if (UNSAFE_METHODS.has(request.method) && !isSameOrigin(request)) {
    return jsonError(403, 'CROSS_SITE_REQUEST', 'Cross-site request blocked.');
  }

  const target = `${REALTIME_URL.replace(/\/$/, '')}/api/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);

  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (sessionToken) headers.set('authorization', `Bearer ${sessionToken}`);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch {
    return jsonError(503, 'SERVICE_UNAVAILABLE', 'The game service is temporarily unavailable. Please try again shortly.');
  }

  const contentType = upstream.headers.get('content-type') || 'application/json';

  // Login/registration/guest: move the session token from the body into the httpOnly cookie.
  if (SESSION_ISSUING_PATHS.has(route) && upstream.ok && contentType.includes('application/json')) {
    const data = await upstream.json();
    const token: string | undefined = data?.token;
    const maxAge: number = data?.session?.maxAgeSeconds || 24 * 60 * 60;
    delete data.token;
    const response = NextResponse.json(data, { status: upstream.status });
    response.headers.set('cache-control', 'no-store');
    if (token) response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(request, maxAge));
    return response;
  }

  const body = await upstream.arrayBuffer();
  const response = new NextResponse(body, { status: upstream.status, headers: { 'content-type': contentType } });

  // Logout, or the backend says this session itself is no longer valid: drop the cookie.
  // Any other 401 (e.g. one route refusing access) must not sign the player out everywhere.
  const endsSession = SESSION_ENDING_PATHS.has(route) && upstream.ok;
  if (sessionToken && (endsSession || (upstream.status === 401 && isDeadSessionResponse(body)))) {
    response.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(request, 0));
  }
  return response;
}

const DEAD_SESSION_CODES = new Set(['SESSION_EXPIRED', 'SESSION_REVOKED', 'SESSION_INVALID', 'INVALID_TOKEN']);

/** True when a 401 body carries one of the backend's session-is-gone codes. */
function isDeadSessionResponse(body: ArrayBuffer): boolean {
  try {
    const code = JSON.parse(new TextDecoder().decode(body))?.code;
    return typeof code === 'string' && DEAD_SESSION_CODES.has(code);
  } catch {
    return false;
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
