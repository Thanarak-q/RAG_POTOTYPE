import { jsonError, jsonOk } from '@/lib/http';
import { createRuntime } from '@/lib/runtime';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const runtime = createRuntime();
    await Promise.all([
      runtime.knowledgeRepository.health(),
      runtime.vectorRepository.health(),
    ]);
    return jsonOk({ ok: true });
  } catch {
    return jsonError('Health check failed', 503);
  }
}
