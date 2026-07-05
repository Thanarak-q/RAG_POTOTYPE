import { getEnv } from '@/env/server';

export async function svcBotFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const env = getEnv();
  const headers = new Headers(init.headers);
  headers.set('x-internal-key', env.INTERNAL_API_KEY);
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  return fetch(`${env.SVC_BOT_URL}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
}

export async function readEnvelope<T>(response: Response): Promise<T> {
  const body = (await response.json()) as {
    success: boolean;
    data?: T;
    error?: string;
  };
  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error ?? `Request failed with ${response.status}`);
  }
  return body.data;
}
