import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

export function encryptCredential(
  plaintext: string,
  keyMaterial: string,
): string {
  const key = toKey(keyMaterial);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext]
    .map((part) => part.toString('base64url'))
    .join('.');
}

export function decryptCredential(
  encrypted: string,
  keyMaterial: string,
): string {
  const [ivEncoded, tagEncoded, ciphertextEncoded] = encrypted.split('.');
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error('Invalid encrypted credential');
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    toKey(keyMaterial),
    Buffer.from(ivEncoded, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function toKey(keyMaterial: string): Buffer {
  const key = Buffer.from(keyMaterial, 'utf8');
  if (key.length !== 32) {
    throw new Error('CREDENTIALS_ENC_KEY must be exactly 32 bytes');
  }
  return key;
}
