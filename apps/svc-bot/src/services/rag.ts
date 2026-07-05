import type { LlmProvider } from '@line-rag/llm-gateway';
import type { ChatRequestBody, KnowledgeChunk } from '@line-rag/shared';
import type {
  ChatRepository,
  KnowledgeRepository,
  VectorRepository,
} from '@/repositories/types';
import { buildRagMessages } from './prompt';

const SCORE_THRESHOLD = 0.3;
const HISTORY_LIMIT = 6;

export interface RagResponse {
  answer: string;
  model: string;
  latencyMs: number;
  retrievedChunks: KnowledgeChunk[];
}

export async function answerQuestion(params: {
  request: ChatRequestBody;
  knowledgeRepository: KnowledgeRepository;
  chatRepository: ChatRepository;
  vectorRepository: VectorRepository;
  llm: LlmProvider;
}): Promise<RagResponse> {
  const lineUserId = params.request.lineUserId ?? 'web-playground';
  const sessionId = await params.chatRepository.getOrCreateSession(lineUserId);
  await params.chatRepository.appendMessage({
    sessionId,
    role: 'user',
    content: params.request.message,
  });

  const [embedding] = await params.llm.embed([params.request.message]);
  const matches = await params.vectorRepository.query({
    embedding: embedding ?? [],
    topK: 5,
    ...(params.request.sourceType
      ? { sourceType: params.request.sourceType }
      : {}),
  });
  const relevantMatches = matches.filter(
    (match) => match.score >= SCORE_THRESHOLD,
  );
  const chunksById = await params.knowledgeRepository.findChunksByPineconeIds(
    relevantMatches.map((match) => match.id),
  );
  const chunks: KnowledgeChunk[] = relevantMatches.flatMap((match) => {
    const chunk = chunksById.find(
      (candidate) => candidate.pineconeId === match.id,
    );
    return chunk ? [{ ...chunk, score: match.score }] : [];
  });
  const history = await params.chatRepository.listRecentMessages(
    sessionId,
    HISTORY_LIMIT,
  );
  const response = await params.llm.chat({
    messages: buildRagMessages({
      question: params.request.message,
      chunks,
      history,
    }),
  });

  await params.chatRepository.appendMessage({
    sessionId,
    role: 'assistant',
    content: response.content,
    retrievedChunkIds: chunks.map((chunk) => chunk.id),
    model: response.model,
    latencyMs: response.latencyMs,
  });

  return {
    answer: response.content,
    model: response.model,
    latencyMs: response.latencyMs,
    retrievedChunks: chunks,
  };
}
