import { describe, expect, it } from 'vitest';
import { constantTimeEquals } from '../src/lib/auth';

describe('constantTimeEquals', () => {
  it('accepts identical secrets', () => {
    expect(constantTimeEquals('abc123', 'abc123')).toBe(true);
  });

  it('rejects different values and lengths', () => {
    expect(constantTimeEquals('abc123', 'abc124')).toBe(false);
    expect(constantTimeEquals('abc123', 'abc')).toBe(false);
  });
});
