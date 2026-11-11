import { anthropic } from '@ai-sdk/anthropic';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
} from 'ai';

import { tools, type ChatMessage } from '@/lib/tools';

const systemPrompt = () => `You are a helpful assistant inside a mobile app.
Keep answers short: they are read on a phone.
You can use the phone through tools: get the user's location, and draft calendar events the user confirms in the native sheet.
Never claim an event was saved unless the tool result says "saved".
Right now it is ${new Date().toString()} (ISO: ${new Date().toISOString()}).
For calendar events, resolve relative dates like "tomorrow" from this exact moment, use the current year, and include the timezone offset in startISO/endISO.`;

export async function POST(request: Request) {
  const { messages }: { messages: ChatMessage[] } = await request.json();

  const result = streamText({
    model: anthropic(process.env.AI_MODEL || 'claude-sonnet-5-5'),
    system: systemPrompt(),
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: isStepCount(5),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      originalMessages: messages,
      // Show real errors while developing; keep them generic in production.
      onError: (error) => {
        console.error('[chat api]', error);
        return process.env.NODE_ENV !== 'production' && error instanceof Error
          ? error.message
          : 'The assistant is unavailable right now.';
      },
    }),
    headers: {
      // Needed so React Native receives the stream chunk by chunk.
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'none',
    },
  });
}
