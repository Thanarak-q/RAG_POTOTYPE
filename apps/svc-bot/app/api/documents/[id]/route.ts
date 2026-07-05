import { NextRequest } from 'next/server';
import { isInternalRequest } from '@/lib/auth';
import { jsonError, jsonOk, routeError } from '@/lib/http';
import { createRuntime } from '@/lib/runtime';

export const runtime = 'nodejs';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const runtime = createRuntime();
    if (!isInternalRequest(request, runtime.env.INTERNAL_API_KEY)) {
      return jsonError('Unauthorized', 401);
    }
    const { id } = await context.params;
    const pineconeIds = await runtime.knowledgeRepository.deleteDocument(id);
    await runtime.vectorRepository.delete(pineconeIds);
    return jsonOk({ deleted: true });
  } catch (error) {
    return routeError(error);
  }
}
