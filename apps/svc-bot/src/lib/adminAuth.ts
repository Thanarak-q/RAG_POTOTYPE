import { NextRequest } from 'next/server';
import { constantTimeEquals } from './auth';

export type AdminContext =
  | { role: 'tenant_admin'; tenantId: string; userId: string }
  | { role: 'super_admin'; userId: string };

export function getAdminContext(request: NextRequest): AdminContext | null {
  const role = request.headers.get('x-admin-role');
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return null;
  }
  if (role === 'super_admin') {
    return { role, userId };
  }
  if (role === 'tenant_admin') {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return null;
    }
    return { role, tenantId, userId };
  }
  return null;
}

export function requireTenantAdmin(
  request: NextRequest,
): Extract<AdminContext, { role: 'tenant_admin' }> {
  const context = getAdminContext(request);
  if (!context || context.role !== 'tenant_admin') {
    throw new Error('Tenant admin role required');
  }
  return context;
}

export function requirePlatformAdmin(
  request: NextRequest,
  expectedPlatformKey: string,
): Extract<AdminContext, { role: 'super_admin' }> {
  const providedPlatformKey = request.headers.get('x-platform-key') ?? '';
  if (!constantTimeEquals(providedPlatformKey, expectedPlatformKey)) {
    throw new Error('Platform service key required');
  }
  const context = getAdminContext(request);
  if (!context || context.role !== 'super_admin') {
    throw new Error('Platform admin role required');
  }
  return context;
}
