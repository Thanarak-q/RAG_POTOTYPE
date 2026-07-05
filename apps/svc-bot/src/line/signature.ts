import { createHmac, timingSafeEqual } from 'node:crypto';

export function createLineSignature(
  rawBody: string,
  channelSecret: string,
): string {
  return createHmac('sha256', channelSecret).update(rawBody).digest('base64');
}

export function verifyLineSignature(params: {
  rawBody: string;
  channelSecret: string;
  signature: string | null;
}): boolean {
  if (!params.signature) {
    return false;
  }
  const expected = Buffer.from(
    createLineSignature(params.rawBody, params.channelSecret),
    'utf8',
  );
  const actual = Buffer.from(params.signature, 'utf8');
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}
