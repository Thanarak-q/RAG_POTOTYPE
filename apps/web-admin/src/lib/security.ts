const encoder = new TextEncoder();

export async function createSessionToken(secret: string): Promise<string> {
  const issuedAt = Date.now().toString();
  const nonce = crypto.randomUUID();
  const payload = `${issuedAt}.${nonce}`;
  return `${payload}.${await sign(payload, secret)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string,
  options: { maxAgeMs?: number } = {},
): Promise<boolean> {
  if (!token) {
    return false;
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }
  const [issuedAt, nonce, signature] = parts;
  if (!issuedAt || !nonce || !signature) {
    return false;
  }
  const issuedAtMs = Number(issuedAt);
  if (!Number.isSafeInteger(issuedAtMs)) {
    return false;
  }
  const maxAgeMs = options.maxAgeMs ?? 12 * 60 * 60 * 1000;
  if (Date.now() - issuedAtMs > maxAgeMs) {
    return false;
  }
  const payload = `${issuedAt}.${nonce}`;
  return signature === (await sign(payload, secret));
}

export async function createCsrfToken(
  sessionToken: string,
  secret: string,
): Promise<string> {
  const nonce = crypto.randomUUID();
  const payload = `${nonce}.${sessionToken}`;
  return `${nonce}.${await sign(payload, secret)}`;
}

export async function verifyCsrfToken(
  token: string | undefined,
  sessionToken: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!token || !sessionToken) {
    return false;
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    return false;
  }
  const [nonce, signature] = parts;
  if (!nonce || !signature) {
    return false;
  }
  return signature === (await sign(`${nonce}.${sessionToken}`, secret));
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload),
  );
  return base64Url(new Uint8Array(signature));
}

function base64Url(bytes: Uint8Array): string {
  let value = '';
  for (const byte of bytes) {
    value += String.fromCharCode(byte);
  }
  return btoa(value)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}
