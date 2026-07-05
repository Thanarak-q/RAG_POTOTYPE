import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('admin_session');
  cookieStore.delete('csrf_token');
  return NextResponse.redirect(
    new URL(
      '/login',
      process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
    ),
    303,
  );
}
