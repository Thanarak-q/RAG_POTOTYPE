import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/env/server';
import { createCsrfToken, createSessionToken } from '@/lib/security';

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const password = String(form.get('password') ?? '');
  if (password !== getEnv().ADMIN_PASSWORD) {
    return NextResponse.redirect(new URL('/login?error=1', request.url), 303);
  }
  const env = getEnv();
  const sessionToken = await createSessionToken(env.ADMIN_PASSWORD);
  const csrfToken = await createCsrfToken(sessionToken, env.ADMIN_PASSWORD);
  const cookieStore = await cookies();
  cookieStore.set('admin_session', sessionToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  cookieStore.set('csrf_token', csrfToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return NextResponse.redirect(new URL('/documents', request.url), 303);
}
