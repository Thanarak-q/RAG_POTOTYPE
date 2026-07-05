import { createTenantSchema } from '@line-rag/shared';
import { NextRequest } from 'next/server';
import { jsonError, jsonOk, routeError } from '@/lib/http';
import { requirePlatformAdmin } from '@/lib/adminAuth';
import { getEnv } from '@/env/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    requirePlatformAdmin(request, getPlatformKey());
    return jsonOk({ tenants: [] });
  } catch (error) {
    return authOrRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requirePlatformAdmin(request, getPlatformKey());
    const tenant = createTenantSchema.parse(await request.json());
    return jsonOk(
      { tenant: { ...tenant, status: 'active' }, persisted: false },
      { status: 202 },
    );
  } catch (error) {
    return authOrRouteError(error);
  }
}

function getPlatformKey(): string {
  return getEnv().PLATFORM_SERVICE_KEY ?? getEnv().INTERNAL_API_KEY;
}

function authOrRouteError(error: unknown) {
  if (
    error instanceof Error &&
    (error.message.includes('Platform admin') ||
      error.message.includes('Platform service'))
  ) {
    return jsonError('Forbidden', 403);
  }
  return routeError(error);
}
