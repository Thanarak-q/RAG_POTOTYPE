import { cookies } from 'next/headers';
import { getEnv } from '@/env/server';
import { verifyCsrfToken } from './security';

export async function getCsrfToken(): Promise<string> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('admin_session')?.value;
  if (!sessionToken) {
    return '';
  }
  const existingToken = cookieStore.get('csrf_token')?.value;
  if (
    await verifyCsrfToken(existingToken, sessionToken, getEnv().ADMIN_PASSWORD)
  ) {
    return existingToken ?? '';
  }
  return '';
}

export async function verifyRequestCsrf(request: Request): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('admin_session')?.value;
  const cookieToken = cookieStore.get('csrf_token')?.value;
  const headerToken = request.headers.get('x-csrf-token') ?? undefined;
  if (!headerToken || headerToken !== cookieToken) {
    return false;
  }
  return verifyCsrfToken(headerToken, sessionToken, getEnv().ADMIN_PASSWORD);
}

export async function verifyFormCsrf(formData: FormData): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('admin_session')?.value;
  const cookieToken = cookieStore.get('csrf_token')?.value;
  const formToken = String(formData.get('csrfToken') ?? '');
  if (!formToken || formToken !== cookieToken) {
    return false;
  }
  return verifyCsrfToken(formToken, sessionToken, getEnv().ADMIN_PASSWORD);
}
