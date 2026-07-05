import type { ApiEnvelope } from '@line-rag/shared';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function jsonOk<T>(
  data: T,
  init?: ResponseInit,
): NextResponse<ApiEnvelope<T>> {
  return NextResponse.json({ success: true, data }, init);
}

export function jsonError(
  message: string,
  status = 400,
): NextResponse<ApiEnvelope<never>> {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function routeError(error: unknown): NextResponse<ApiEnvelope<never>> {
  if (error instanceof ZodError) {
    return jsonError('Invalid request body', 400);
  }
  return jsonError('Internal server error', 500);
}
