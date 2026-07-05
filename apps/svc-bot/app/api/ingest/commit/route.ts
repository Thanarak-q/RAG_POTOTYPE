import { parseCsv, validateProductRows } from '@line-rag/agent';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { isInternalRequest } from '@/lib/auth';
import { jsonError, jsonOk, routeError } from '@/lib/http';
import { createRuntime } from '@/lib/runtime';

const commitSchema = z.object({
  tenantId: z.string().min(1),
  csv: z.string().min(1).max(10_000_000),
  sourceFileId: z.string().min(1).optional(),
});

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const runtime = createRuntime();
    if (!isInternalRequest(request, runtime.env.INTERNAL_API_KEY)) {
      return jsonError('Unauthorized', 401);
    }
    const body = commitSchema.parse(await request.json());
    const rows = parseCsv(body.csv);
    const result = validateProductRows(rows, {
      tenantId: body.tenantId,
      ...(body.sourceFileId ? { sourceFileId: body.sourceFileId } : {}),
    });
    return jsonOk({
      rowCount: rows.length,
      validRows: result.validRows,
      errors: result.errors,
      committed: false,
    });
  } catch (error) {
    return routeError(error);
  }
}
