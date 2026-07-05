import { productUpsertSchema } from '@line-rag/shared';
import { NextRequest } from 'next/server';
import { jsonError, jsonOk, routeError } from '@/lib/http';
import { requireTenantAdmin } from '@/lib/adminAuth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const context = requireTenantAdmin(request);
    return jsonOk({ tenantId: context.tenantId, products: [] });
  } catch (error) {
    return authOrRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = requireTenantAdmin(request);
    const body = await request.json();
    const product = productUpsertSchema.parse({
      ...body,
      tenantId: context.tenantId,
    });
    return jsonOk({ product, persisted: false }, { status: 202 });
  } catch (error) {
    return authOrRouteError(error);
  }
}

function authOrRouteError(error: unknown) {
  if (error instanceof Error && error.message.includes('Tenant admin')) {
    return jsonError('Forbidden', 403);
  }
  return routeError(error);
}
