import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearAll, loadMessages, loadQueue, saveMessages, saveQueue } from '../storage';
import type { ChatMessage } from '../tools';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const message = { id: '1', role: 'user', parts: [{ type: 'text', text: 'hi' }] } as ChatMessage;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('messages', () => {
  it('start empty', async () => {
    await expect(loadMessages()).resolves.toEqual([]);
  });

  it('round-trip through storage', async () => {
    await saveMessages([message]);
    await expect(loadMessages()).resolves.toEqual([message]);
  });

  it('fall back to empty when the stored JSON is corrupt', async () => {
    await AsyncStorage.setItem('chat/messages/v1', '{not json');
    await expect(loadMessages()).resolves.toEqual([]);
  });

  it('do not throw when writing fails', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    await expect(saveMessages([message])).resolves.toBeUndefined();
  });
});

describe('offline queue', () => {
  it('starts empty and round-trips in order', async () => {
    await expect(loadQueue()).resolves.toEqual([]);
    await saveQueue(['first', 'second']);
    await expect(loadQueue()).resolves.toEqual(['first', 'second']);
  });
});

describe('clearAll', () => {
  it('removes both messages and the queue', async () => {
    await saveMessages([message]);
    await saveQueue(['x']);
    await clearAll();
    await expect(loadMessages()).resolves.toEqual([]);
    await expect(loadQueue()).resolves.toEqual([]);
  });
});
