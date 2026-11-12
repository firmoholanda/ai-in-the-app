import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ChatMessage } from './tools';

const MESSAGES_KEY = 'chat/messages/v1';
const QUEUE_KEY = 'chat/queue/v1';

/** Storage is best-effort (the chat still works without it), but failures must stay visible while developing. */
const warn = (action: string, key: string, error: unknown) => {
  if (__DEV__) console.warn(`[storage] could not ${action} "${key}"`, error);
};

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (error) {
    warn('read', key, error);
    return fallback;
  }
}

async function write(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    warn('write', key, error);
  }
}

export const loadMessages = () => read<ChatMessage[]>(MESSAGES_KEY, []);
export const saveMessages = (messages: ChatMessage[]) => write(MESSAGES_KEY, messages);

/** Messages typed while offline, sent in order when the connection comes back. */
export const loadQueue = () => read<string[]>(QUEUE_KEY, []);
export const saveQueue = (queue: string[]) => write(QUEUE_KEY, queue);

export async function clearAll() {
  await AsyncStorage.multiRemove([MESSAGES_KEY, QUEUE_KEY]);
}
