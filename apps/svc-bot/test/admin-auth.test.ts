import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import {
  getAdminContext,
  requirePlatformAdmin,
  requireTenantAdmin,
} from '../src/lib/adminAuth';

describe('admin API authorization boundaries', () => {
  it('extracts tenant context from verified request claims instead of request bodies', () => {
    const request = requestWithHeaders({
      'x-admin-role': 'tenant_admin',
      'x-tenant-id': 'tenant-a',
      'x-user-id': 'user-1',
    });

    expect(requireTenantAdmin(request)).toEqual({
      role: 'tenant_admin',
      tenantId: 'tenant-a',
      userId: 'user-1',
    });
  });

  it('rejects tenant admin context without tenant id', () => {
    const request = requestWithHeaders({
      'x-admin-role': 'tenant_admin',
      'x-user-id': 'user-1',
    });

    expect(() => requireTenantAdmin(request)).toThrow('Tenant admin role required');
  });

  it('requires super admin role and platform service key for platform APIs', () => {
    const request = requestWithHeaders({
      'x-admin-role': 'super_admin',
      'x-user-id': 'owner-1',
      'x-platform-key': 'platform-secret',
    });

    expect(requirePlatformAdmin(request, 'platform-secret')).toEqual({
      role: 'super_admin',
      userId: 'owner-1',
    });
  });

  it('rejects platform APIs when either role or service key is missing', () => {
    expect(() =>
      requirePlatformAdmin(
        requestWithHeaders({
          'x-admin-role': 'tenant_admin',
          'x-user-id': 'user-1',
          'x-platform-key': 'platform-secret',
        }),
        'platform-secret',
      ),
    ).toThrow('Platform admin role required');

    expect(() =>
      requirePlatformAdmin(
        requestWithHeaders({
          'x-admin-role': 'super_admin',
          'x-user-id': 'owner-1',
          'x-platform-key': 'wrong',
        }),
        'platform-secret',
      ),
    ).toThrow('Platform service key required');
  });

  it('treats unknown roles as unauthenticated', () => {
    const request = requestWithHeaders({
      'x-admin-role': 'admin',
      'x-user-id': 'user-1',
    });

    expect(getAdminContext(request)).toBeNull();
  });
});

function requestWithHeaders(headers: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/test', { headers });
}
