import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from './src/lib/security';

const PUBLIC_PATHS = ['/login', '/api/logout'];

export async function middleware(request: NextRequest) {
  if (PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }
  const adminSecret = process.env.ADMIN_PASSWORD;
  if (!adminSecret) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  const isValidSession = await verifySessionToken(
    request.cookies.get('admin_session')?.value,
    adminSecret,
  );
  if (request.nextUrl.pathname.startsWith('/api') && isValidSession) {
    return NextResponse.next();
  }
  if (isValidSession) {
    return NextResponse.next();
  }
  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
