import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthenticated = !!req.auth;

  // ── Always allow Next-Auth internal routes ────────────────────────────────
  if (pathname.startsWith('/api/auth')) return NextResponse.next();

  // ── Always allow static assets ────────────────────────────────────────────
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next();
  }

  const isLoginPage = pathname === '/login';

  // ── Redirect authenticated users away from login ──────────────────────────
  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // ── Block unauthenticated access ──────────────────────────────────────────
  if (!isAuthenticated && !isLoginPage) {
    // API routes → JSON 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }
    // Page routes → redirect to login
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match everything except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
};
