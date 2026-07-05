import { describe, expect, it } from 'vitest';
import { decryptCredential, encryptCredential } from '../src/credentials';

describe('credential encryption', () => {
  it('round-trips tenant LINE credentials with AES-GCM', () => {
    const key = '12345678901234567890123456789012';
    const encrypted = encryptCredential('line-secret', key);

    expect(encrypted).not.toContain('line-secret');
    expect(decryptCredential(encrypted, key)).toBe('line-secret');
    expect(() =>
      decryptCredential(encrypted, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    ).toThrow();
  });

  it('rejects malformed encrypted payloads and invalid key sizes', () => {
    expect(() => encryptCredential('secret', 'short')).toThrow(
      'CREDENTIALS_ENC_KEY must be exactly 32 bytes',
    );
    expect(() =>
      decryptCredential('not-enough.parts', '12345678901234567890123456789012'),
    ).toThrow('Invalid encrypted credential');
  });
});
