import { describe, expect, it } from 'vitest';
import { chunkText } from '../src/services/chunker';

describe('chunkText', () => {
  it('keeps short paragraph groups together', () => {
    const chunks = chunkText('First paragraph.\n\nSecond paragraph.', {
      maxTokens: 20,
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toContain('Second paragraph.');
  });

  it('splits long text and carries overlap into the next chunk', () => {
    const text = Array.from({ length: 80 }, (_, index) => `word${index}`).join(
      ' ',
    );
    const chunks = chunkText(text, { maxTokens: 30, overlapTokens: 5 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[1]?.content.startsWith('word')).toBe(true);
    expect(chunks[0]?.tokenCount).toBeLessThanOrEqual(30);
  });

  it('rejects invalid overlap settings', () => {
    expect(() =>
      chunkText('text', { maxTokens: 10, overlapTokens: 10 }),
    ).toThrow('overlapTokens must be smaller');
  });
});
