import { chatRequestSchema } from '@line-rag/shared';
import { NextRequest } from 'next/server';
import { isInternalRequest } from '@/lib/auth';
import { jsonError, jsonOk, routeError } from '@/lib/http';
import { internalApiRateLimiter } from '@/lib/rateLimit';
import { createRuntime } from '@/lib/runtime';
import { answerQuestion } from '@/services/rag';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const runtime = createRuntime();
    if (!isInternalRequest(request, runtime.env.INTERNAL_API_KEY)) {
      return jsonError('Unauthorized', 401);
    }
    const rateLimit = internalApiRateLimiter.check('internal:chat');
    if (!rateLimit.allowed) {
      return jsonError('Too many requests', 429);
    }
    const body = chatRequestSchema.parse(await request.json());
    const result = await answerQuestion({ request: body, ...runtime });
    return jsonOk(result);
  } catch (error) {
    return routeError(error);
  }
}
