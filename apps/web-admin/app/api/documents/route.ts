import { NextResponse } from 'next/server';
import { svcBotFetch } from '@/lib/svcBot';

export async function GET() {
  const response = await svcBotFetch('/api/documents');
  return proxy(response);
}

function proxy(response: Response) {
  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      'content-type':
        response.headers.get('content-type') ?? 'application/json',
    },
  });
}
