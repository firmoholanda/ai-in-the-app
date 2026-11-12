import { streamText } from 'ai';

import { MAX_MESSAGES, POST } from '@/app/api/chat+api';

jest.mock('@ai-sdk/anthropic', () => ({ anthropic: jest.fn((model: string) => ({ model })) }));
jest.mock('ai', () => ({
  ...jest.requireActual('ai'),
  convertToModelMessages: jest.fn(async (messages: unknown) => messages),
  createUIMessageStreamResponse: jest.fn(({ headers }: { headers: Record<string, string> }) => new Response('ok', { headers })),
  isStepCount: jest.fn((n: number) => ({ steps: n })),
  streamText: jest.fn(() => ({ stream: 'stream' })),
  toUIMessageStream: jest.fn((options: unknown) => options),
}));

const request = () =>
  new Request('http://localhost/api/chat', {
    method: 'POST',
    body: JSON.stringify({ messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }] }),
  });

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  delete process.env.AI_MODEL;
});

describe('POST /api/chat', () => {
  it('streams with headers React Native needs to receive chunks', async () => {
    const res = await POST(request());
    expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(res.headers.get('Content-Encoding')).toBe('none');
  });

  it('computes the date in the system prompt per request, not at module load', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-11T18:00:00Z'));
    await POST(request());
    jest.setSystemTime(new Date('2027-03-05T09:30:00Z'));
    await POST(request());

    const [first, second] = jest.mocked(streamText).mock.calls.map(([options]) => String(options.system));
    expect(first).toContain('2026-11-11T18:00:00.000Z');
    expect(second).toContain('2027-03-05T09:30:00.000Z');
    expect(second).not.toContain('2026-11-11');
  });

  it('uses the model from AI_MODEL, defaulting to claude-sonnet-5-5', async () => {
    await POST(request());
    expect(jest.mocked(streamText).mock.calls[0][0].model).toEqual({ model: 'claude-sonnet-5-5' });

    process.env.AI_MODEL = 'claude-haiku-5-5';
    await POST(request());
    expect(jest.mocked(streamText).mock.calls[1][0].model).toEqual({ model: 'claude-haiku-5-5' });
  });

  it('exposes the three tools and limits the agent loop', async () => {
    await POST(request());
    const options = jest.mocked(streamText).mock.calls[0][0];
    expect(Object.keys(options.tools ?? {})).toEqual(['getWeather', 'getDeviceLocation', 'draftCalendarEvent']);
    expect(options.stopWhen).toEqual({ steps: 5 });
  });
});

describe('POST /api/chat input validation', () => {
  const post = (body: string) => POST(new Request('http://localhost/api/chat', { method: 'POST', body }));

  it.each([
    ['malformed JSON', '{nope'],
    ['a missing messages field', '{}'],
    ['a non-array messages field', JSON.stringify({ messages: 'hi' })],
    ['an empty messages array', JSON.stringify({ messages: [] })],
    ['too many messages', JSON.stringify({ messages: Array.from({ length: MAX_MESSAGES + 1 }, () => ({})) })],
  ])('rejects %s with 400 and never calls the model', async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: expect.any(String) });
    expect(streamText).not.toHaveBeenCalled();
  });
});
