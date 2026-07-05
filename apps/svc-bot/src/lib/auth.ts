import { timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';

function safeBuffer(value: string): Buffer {
  return Buffer.from(value, 'utf8');
}

export function constantTimeEquals(actual: string, expected: string): boolean {
  const actualBuffer = safeBuffer(actual);
  const expectedBuffer = safeBuffer(expected);
  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function isInternalRequest(
  request: NextRequest,
  expectedKey: string,
): boolean {
  const providedKey = request.headers.get('x-internal-key') ?? '';
  return constantTimeEquals(providedKey, expectedKey);
}
