import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ChatMessage } from './tools';

const MESSAGES_KEY = 'chat/messages/v1';
const QUEUE_KEY = 'chat/queue/v1';

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function write(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const loadMessages = () => read<ChatMessage[]>(MESSAGES_KEY, []);
export const saveMessages = (messages: ChatMessage[]) => write(MESSAGES_KEY, messages);

/** Messages typed while offline, sent in order when the connection comes back. */
export const loadQueue = () => read<string[]>(QUEUE_KEY, []);
export const saveQueue = (queue: string[]) => write(QUEUE_KEY, queue);

export async function clearAll() {
  await AsyncStorage.multiRemove([MESSAGES_KEY, QUEUE_KEY]);
}
