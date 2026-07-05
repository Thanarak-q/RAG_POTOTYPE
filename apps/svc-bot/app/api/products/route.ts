import { productUpsertSchema } from '@line-rag/shared';
import { NextRequest } from 'next/server';
import { z } from 'zod';
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
    const tenantId = z
      .string()
      .min(1)
      .parse(request.nextUrl.searchParams.get('tenantId'));
    return jsonOk({ tenantId, products: [] });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const runtime = createRuntime();
    if (!isInternalRequest(request, runtime.env.INTERNAL_API_KEY)) {
      return jsonError('Unauthorized', 401);
    }
    const product = productUpsertSchema.parse(await request.json());
    return jsonOk({ product, persisted: false }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
