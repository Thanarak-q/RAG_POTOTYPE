import { ingestRequestSchema } from '@line-rag/shared';
import { NextRequest } from 'next/server';
import { isInternalRequest } from '@/lib/auth';
import { jsonError, jsonOk, routeError } from '@/lib/http';
import { internalApiRateLimiter } from '@/lib/rateLimit';
import { createRuntime } from '@/lib/runtime';
import { ingestDocument } from '@/services/ingest';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const runtime = createRuntime();
    if (!isInternalRequest(request, runtime.env.INTERNAL_API_KEY)) {
      return jsonError('Unauthorized', 401);
    }
    if (!internalApiRateLimiter.check('internal:ingest:text').allowed) {
      return jsonError('Too many requests', 429);
    }
    const body = ingestRequestSchema.parse(await request.json());
    const result = await ingestDocument({ request: body, ...runtime });
    return jsonOk(result);
  } catch (error) {
    return routeError(error);
  }
}
