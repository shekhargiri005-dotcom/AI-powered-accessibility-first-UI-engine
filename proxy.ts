import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const proxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  const isApiRoute = req.nextUrl.pathname.startsWith('/api/');
  const isAuthRoute = req.nextUrl.pathname.startsWith('/api/auth');
  const isPublicRoute = req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/';

  // Protect /api/generate and other critical routes
  if (!isLoggedIn && (isApiRoute && !isAuthRoute) && req.nextUrl.pathname.startsWith('/api/generate')) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized. Please log in.' },
      { status: 401 }
    );
  }

  // Redirect to login if not logged in and trying to access settings
  if (!isLoggedIn && req.nextUrl.pathname.startsWith('/settings')) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/api/generate/:path*', '/settings/:path*'],
};
