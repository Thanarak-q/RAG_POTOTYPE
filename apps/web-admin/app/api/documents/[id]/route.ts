import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestCsrf } from '@/lib/csrf';
import { svcBotFetch } from '@/lib/svcBot';

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await verifyRequestCsrf(_request))) {
    return NextResponse.json(
      { success: false, error: 'Forbidden' },
      { status: 403 },
    );
  }
  const { id } = await context.params;
  const response = await svcBotFetch(
    `/api/documents/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  );
  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      'content-type':
        response.headers.get('content-type') ?? 'application/json',
    },
  });
}
