import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestCsrf } from '@/lib/csrf';
import { svcBotFetch } from '@/lib/svcBot';

export async function POST(request: NextRequest) {
  if (!(await verifyRequestCsrf(request))) {
    return NextResponse.json(
      { success: false, error: 'Forbidden' },
      { status: 403 },
    );
  }
  const response = await svcBotFetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify(await request.json()),
  });
  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      'content-type':
        response.headers.get('content-type') ?? 'application/json',
    },
  });
}
