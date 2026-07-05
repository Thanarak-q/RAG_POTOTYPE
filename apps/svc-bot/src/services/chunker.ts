export interface TextChunk {
  content: string;
  tokenCount: number;
}

const DEFAULT_MAX_TOKENS = 500;
const DEFAULT_OVERLAP_TOKENS = 50;

export function estimateTokenCount(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words * 1.35));
}

export function chunkText(
  rawText: string,
  options: { maxTokens?: number; overlapTokens?: number } = {},
): TextChunk[] {
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const overlapTokens =
    options.overlapTokens ?? Math.min(DEFAULT_OVERLAP_TOKENS, maxTokens - 1);
  if (overlapTokens >= maxTokens) {
    throw new Error('overlapTokens must be smaller than maxTokens');
  }

  const paragraphs = rawText
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: TextChunk[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (estimateTokenCount(candidate) <= maxTokens) {
      current = candidate;
      continue;
    }
    if (current) {
      chunks.push(toChunk(current));
      current = trailingWords(current, overlapTokens);
    }
    current = appendWithLimit(
      current,
      paragraph,
      maxTokens,
      chunks,
      overlapTokens,
    );
  }

  if (current.trim()) {
    chunks.push(toChunk(current));
  }

  return chunks;
}

function appendWithLimit(
  prefix: string,
  text: string,
  maxTokens: number,
  chunks: TextChunk[],
  overlapTokens: number,
): string {
  const words = text.split(/\s+/).filter(Boolean);
  let current = prefix;

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateTokenCount(candidate) <= maxTokens) {
      current = candidate;
      continue;
    }
    if (current) {
      chunks.push(toChunk(current));
      current = trailingWords(current, overlapTokens);
    }
    current = current ? `${current} ${word}` : word;
  }

  return current;
}

function trailingWords(text: string, count: number): string {
  return text.split(/\s+/).filter(Boolean).slice(-count).join(' ');
}

function toChunk(content: string): TextChunk {
  const trimmed = content.trim();
  return {
    content: trimmed,
    tokenCount: estimateTokenCount(trimmed),
  };
}
