import { describe, expect, it } from 'vitest';
import {
  createCsrfToken,
  createSessionToken,
  verifyCsrfToken,
  verifySessionToken,
} from '../src/lib/security';

const signingKeyFixture = 'unit-test-signing-key-with-enough-entropy';

describe('admin session security', () => {
  it('accepts a signed session token and rejects forged values', async () => {
    const token = await createSessionToken(signingKeyFixture);

    await expect(verifySessionToken(token, signingKeyFixture)).resolves.toBe(
      true,
    );
    await expect(
      verifySessionToken('authenticated', signingKeyFixture),
    ).resolves.toBe(false);
    await expect(
      verifySessionToken(token.replace(/\.[^.]+$/, '.bad'), signingKeyFixture),
    ).resolves.toBe(false);
  });

  it('rejects a session token signed with a different secret', async () => {
    const token = await createSessionToken(signingKeyFixture);

    await expect(verifySessionToken(token, 'different-secret')).resolves.toBe(
      false,
    );
  });

  it('rejects missing, malformed, and expired session tokens', async () => {
    const expiredToken = await createSessionToken(signingKeyFixture);

    await expect(verifySessionToken(undefined, signingKeyFixture)).resolves.toBe(
      false,
    );
    await expect(verifySessionToken('1.2', signingKeyFixture)).resolves.toBe(
      false,
    );
    await expect(
      verifySessionToken('.nonce.signature', signingKeyFixture),
    ).resolves.toBe(false);
    await expect(
      verifySessionToken('not-a-number.nonce.signature', signingKeyFixture),
    ).resolves.toBe(false);
    await expect(
      verifySessionToken(expiredToken, signingKeyFixture, { maxAgeMs: -1 }),
    ).resolves.toBe(false);
  });
});

describe('csrf security', () => {
  it('binds csrf tokens to the signed admin session', async () => {
    const session = await createSessionToken(signingKeyFixture);
    const csrf = await createCsrfToken(session, signingKeyFixture);

    await expect(
      verifyCsrfToken(csrf, session, signingKeyFixture),
    ).resolves.toBe(true);
    await expect(
      verifyCsrfToken(csrf, 'other-session', signingKeyFixture),
    ).resolves.toBe(false);
    await expect(
      verifyCsrfToken('bad-token', session, signingKeyFixture),
    ).resolves.toBe(false);
    await expect(
      verifyCsrfToken(undefined, session, signingKeyFixture),
    ).resolves.toBe(false);
    await expect(
      verifyCsrfToken(csrf, undefined, signingKeyFixture),
    ).resolves.toBe(false);
    await expect(
      verifyCsrfToken('.signature', session, signingKeyFixture),
    ).resolves.toBe(false);
  });
});
