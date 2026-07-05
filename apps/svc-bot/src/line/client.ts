export interface LineClient {
  startLoading(lineUserId: string): Promise<void>;
  reply(replyToken: string, text: string): Promise<void>;
  push(lineUserId: string, text: string): Promise<void>;
}

export class LineMessagingClient implements LineClient {
  constructor(private readonly channelAccessToken: string) {}

  async startLoading(lineUserId: string): Promise<void> {
    await this.post('/v2/bot/chat/loading/start', {
      chatId: lineUserId,
      loadingSeconds: 20,
    });
  }

  async reply(replyToken: string, text: string): Promise<void> {
    await this.post('/v2/bot/message/reply', {
      replyToken,
      messages: [{ type: 'text', text: truncateLineText(text) }],
    });
  }

  async push(lineUserId: string, text: string): Promise<void> {
    await this.post('/v2/bot/message/push', {
      to: lineUserId,
      messages: [{ type: 'text', text: truncateLineText(text) }],
    });
  }

  private async post(path: string, body: unknown): Promise<void> {
    const response = await fetch(`https://api.line.me${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.channelAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LINE API ${path} failed: ${response.status} ${text}`);
    }
  }
}

export function truncateLineText(text: string): string {
  return text.length > 5000 ? text.slice(0, 4997) + '...' : text;
}
