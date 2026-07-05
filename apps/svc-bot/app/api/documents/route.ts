import { NextRequest } from 'next/server';
import { isInternalRequest } from '@/lib/auth';
import { jsonError, jsonOk, routeError } from '@/lib/http';
import { createRuntime } from '@/lib/runtime';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const runtime = createRuntime();
    if (!isInternalRequest(request, runtime.env.INTERNAL_API_KEY)) {
      return jsonError('Unauthorized', 401);
    }
    const documents = await runtime.knowledgeRepository.listDocuments();
    return jsonOk({ documents });
  } catch (error) {
    return routeError(error);
  }
}
