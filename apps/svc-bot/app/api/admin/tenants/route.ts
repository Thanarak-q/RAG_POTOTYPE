import { createTenantSchema } from '@line-rag/shared';
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
    return jsonOk({ tenants: [] });
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
    const tenant = createTenantSchema.parse(await request.json());
    return jsonOk(
      { tenant: { ...tenant, status: 'active' }, persisted: false },
      { status: 202 },
    );
  } catch (error) {
    return routeError(error);
  }
}
