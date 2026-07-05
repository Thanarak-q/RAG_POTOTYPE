import { chatRequestSchema } from '@line-rag/shared';
import { NextRequest } from 'next/server';
import { jsonError, jsonOk } from '@/lib/http';
import { lineWebhookRateLimiter } from '@/lib/rateLimit';
import { createRuntime } from '@/lib/runtime';
import { verifyLineSignature } from '@/line/signature';
import { answerQuestion } from '@/services/rag';

export const runtime = 'nodejs';
export const maxDuration = 60;

type LineWebhookEvent =
  | {
      type: 'message';
      replyToken: string;
      source: { userId?: string };
      message: { type: string; text?: string };
    }
  | { type: string };

export async function POST(request: NextRequest) {
  const runtime = createRuntime();
  const rawBody = await request.text();
  const isValid = verifyLineSignature({
    rawBody,
    channelSecret: runtime.env.LINE_CHANNEL_SECRET,
    signature: request.headers.get('x-line-signature'),
  });
  if (!isValid) {
    return jsonError('Unauthorized', 401);
  }

  let payload: { events?: LineWebhookEvent[] };
  try {
    payload = JSON.parse(rawBody) as { events?: LineWebhookEvent[] };
  } catch {
    return jsonError('Invalid request body', 400);
  }
  await Promise.all(
    (payload.events ?? []).map((event) => handleEvent(event, runtime)),
  );
  return jsonOk({ accepted: true });
}

async function handleEvent(
  event: LineWebhookEvent,
  runtime: ReturnType<typeof createRuntime>,
) {
  if (event.type !== 'message' || !('message' in event)) {
    return;
  }
  const lineUserId = event.source.userId;
  if (!lineUserId) {
    return;
  }
  const rateLimit = lineWebhookRateLimiter.check(lineUserId);
  if (!rateLimit.allowed) {
    await runtime.lineClient.reply(
      event.replyToken,
      'Too many messages. Please wait a minute and try again.',
    );
    return;
  }

  await runtime.lineClient.startLoading(lineUserId).catch(() => undefined);

  if (event.message.type !== 'text' || !event.message.text) {
    await runtime.lineClient.reply(event.replyToken, 'Text only for now.');
    return;
  }
  const parsedMessage = chatRequestSchema.safeParse({
    lineUserId,
    message: event.message.text,
  });
  if (!parsedMessage.success) {
    await runtime.lineClient.reply(
      event.replyToken,
      'Please send a shorter text message.',
    );
    return;
  }

  try {
    const result = await answerQuestion({
      request: parsedMessage.data,
      ...runtime,
    });
    await runtime.lineClient.reply(event.replyToken, result.answer);
  } catch {
    const fallback =
      'Sorry, I could not answer that right now. Please try again.';
    await runtime.lineClient
      .reply(event.replyToken, fallback)
      .catch(async () => {
        await runtime.lineClient.push(lineUserId, fallback);
      });
  }
}
