import { describe, expect, it } from 'vitest';
import {
  createLineSignature,
  verifyLineSignature,
} from '../src/line/signature';

describe('verifyLineSignature', () => {
  it('accepts a valid LINE signature', () => {
    const rawBody = JSON.stringify({ events: [] });
    const channelSecret = 'secret';
    const signature = createLineSignature(rawBody, channelSecret);

    expect(verifyLineSignature({ rawBody, channelSecret, signature })).toBe(
      true,
    );
  });

  it('rejects an invalid signature', () => {
    expect(
      verifyLineSignature({
        rawBody: '{"events":[]}',
        channelSecret: 'secret',
        signature: 'invalid',
      }),
    ).toBe(false);
  });

  it('rejects a missing signature', () => {
    expect(
      verifyLineSignature({
        rawBody: '{"events":[]}',
        channelSecret: 'secret',
        signature: null,
      }),
    ).toBe(false);
  });
});
