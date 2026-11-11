import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';
import { useNetworkState } from 'expo-network';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MessageBubble } from '@/components/message-bubble';
import { apiUrl } from '@/lib/api-url';
import { draftCalendarEvent, getDeviceLocation } from '@/lib/native-tools';
import { clearAll, loadMessages, loadQueue, saveMessages, saveQueue } from '@/lib/storage';
import type { ChatMessage } from '@/lib/tools';
import { font, radius, space, useColors } from '@/theme';

const SUGGESTIONS = [
  'What’s the weather where I am?',
  'Add a 30 min focus block tomorrow at 10:00',
  'Where am I right now?',
];

/** Loads saved history first, then mounts the chat with it. */
export default function ChatScreen() {
  const [initial, setInitial] = useState<{ messages: ChatMessage[]; queue: string[] } | null>(null);
  const [session, setSession] = useState(0);

  useEffect(() => {
    Promise.all([loadMessages(), loadQueue()]).then(([messages, queue]) => setInitial({ messages, queue }));
  }, [session]);

  const reset = useCallback(async () => {
    await clearAll();
    setInitial(null);
    setSession((s) => s + 1);
  }, []);

  if (!initial) return <Loading />;
  return <Chat key={session} initialMessages={initial.messages} initialQueue={initial.queue} onReset={reset} />;
}

function Chat({
  initialMessages,
  initialQueue,
  onReset,
}: {
  initialMessages: ChatMessage[];
  initialQueue: string[];
  onReset: () => void;
}) {
  const c = useColors();
  const network = useNetworkState();
  const online = network.isConnected !== false && network.isInternetReachable !== false;

  const [input, setInput] = useState('');
  const [queue, setQueue] = useState<string[]>(initialQueue);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const { messages, sendMessage, addToolOutput, status, error, regenerate, clearError, stop } = useChat<ChatMessage>({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      fetch: expoFetch as unknown as typeof globalThis.fetch,
      api: apiUrl('/api/chat'),
    }),
    // Tools without a server `execute` arrive here and run on the phone.
    onToolCall({ toolCall }) {
      if (toolCall.dynamic) return;
      const { toolCallId } = toolCall;
      const fail = (tool: 'getDeviceLocation' | 'draftCalendarEvent') => (e: unknown) =>
        addToolOutput({
          tool,
          toolCallId,
          state: 'output-error',
          errorText: e instanceof Error ? e.message : 'The phone could not run this action.',
        });

      // Not awaited on purpose: the SDK expects addToolOutput to be called later.
      if (toolCall.toolName === 'getDeviceLocation') {
        getDeviceLocation()
          .then((output) => addToolOutput({ tool: 'getDeviceLocation', toolCallId, output }))
          .catch(fail('getDeviceLocation'));
      } else if (toolCall.toolName === 'draftCalendarEvent') {
        draftCalendarEvent(toolCall.input)
          .then((output) => addToolOutput({ tool: 'draftCalendarEvent', toolCallId, output }))
          .catch(fail('draftCalendarEvent'));
      }
    },
    // Once every phone-side tool has a result, continue the conversation automatically.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  const busy = status === 'submitted' || status === 'streaming';

  // Persist history once a response settles.
  useEffect(() => {
    if (status === 'ready') saveMessages(messages);
  }, [messages, status]);

  useEffect(() => {
    saveQueue(queue);
  }, [queue]);

  // Offline fallback: send queued messages one by one when the connection returns.
  const flushing = useRef(false);
  useEffect(() => {
    if (!online || status !== 'ready' || queue.length === 0 || flushing.current) return;
    flushing.current = true;
    const next = queue[0];
    queueMicrotask(() => setQueue((q) => q.slice(1)));
    sendMessage({ text: next }).finally(() => {
      flushing.current = false;
    });
  }, [online, status, queue, sendMessage]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInput('');
    if (!online || busy) setQueue((q) => [...q, trimmed]);
    else sendMessage({ text: trimmed });
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'ai in the app',
          headerRight: () => (
            <Pressable onPress={onReset} accessibilityRole="button" hitSlop={space.md}>
              <Text style={{ color: c.accent, fontSize: font.md }}>New chat</Text>
            </Pressable>
          ),
        }}
      />

      {!online ? (
        <View style={[styles.banner, { backgroundColor: c.warnSoft, borderColor: c.warn }]}>
          <Text style={{ color: c.warn, fontSize: font.sm }}>
            📶 You’re offline. Messages wait here and send when you’re back.
          </Text>
        </View>
      ) : null}

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Empty onPick={submit} />}
          ListFooterComponent={
            <View style={styles.footer}>
              {queue.map((q, i) => (
                <View key={`q-${i}`} style={[styles.queued, { borderColor: c.line }]}>
                  <Text style={{ color: c.muted, fontSize: font.md }}>{q}</Text>
                  <Text style={{ color: c.warn, fontSize: font.xs }}>⏳ queued</Text>
                </View>
              ))}
              {status === 'submitted' ? <ActivityIndicator color={c.accent} style={styles.thinking} /> : null}
              {error ? (
                <View style={[styles.banner, { backgroundColor: c.warnSoft, borderColor: c.warn }]}>
                  <Text style={{ color: c.warn, fontSize: font.sm }}>The reply didn’t arrive. {error.message}</Text>
                  <Pressable
                    onPress={() => {
                      clearError();
                      regenerate();
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={{ color: c.accent, fontSize: font.sm, fontWeight: '600' }}>Try again</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          }
        />

        <View style={[styles.composer, { borderColor: c.line, backgroundColor: c.surface }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={online ? 'Ask anything' : 'Write now, send when online'}
            placeholderTextColor={c.muted}
            style={[styles.input, { color: c.ink }]}
            multiline
            onSubmitEditing={() => submit(input)}
            submitBehavior="submit"
            returnKeyType="send"
          />
          {busy ? (
            <Pressable onPress={stop} style={[styles.send, { backgroundColor: c.line }]} accessibilityRole="button" accessibilityLabel="Stop">
              <Text style={{ color: c.ink, fontSize: font.md }}>■</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => submit(input)}
              disabled={!input.trim()}
              style={[styles.send, { backgroundColor: input.trim() ? c.accent : c.line }]}
              accessibilityRole="button"
              accessibilityLabel="Send"
            >
              <Text style={{ color: c.accentInk, fontSize: font.md, fontWeight: '700' }}>↑</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Empty({ onPick }: { onPick: (text: string) => void }) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: c.ink }]}>Your phone, with an assistant inside</Text>
      <Text style={{ color: c.muted, fontSize: font.sm, textAlign: 'center' }}>
        It can check your location, look up the weather and draft calendar events you approve.
      </Text>
      <View style={styles.chips}>
        {SUGGESTIONS.map((s) => (
          <Pressable key={s} onPress={() => onPick(s)} style={[styles.chip, { backgroundColor: c.accentSoft }]} accessibilityRole="button">
            <Text style={{ color: c.accent, fontSize: font.sm }}>{s}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Loading() {
  const c = useColors();
  return (
    <View style={[styles.screen, styles.center, { backgroundColor: c.bg }]}>
      <ActivityIndicator color={c.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 1, gap: space.md, padding: space.lg },
  footer: { gap: space.md },
  thinking: { alignSelf: 'flex-start', marginLeft: space.lg },
  banner: {
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  queued: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    gap: space.xs,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.md,
    margin: space.lg,
    marginTop: 0,
    padding: space.sm,
    paddingLeft: space.lg,
    borderRadius: radius.lg + space.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, fontSize: font.md, maxHeight: 120, paddingVertical: space.md },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingHorizontal: space.xl },
  emptyTitle: { fontSize: font.xl, fontWeight: '700', textAlign: 'center' },
  chips: { gap: space.md, alignSelf: 'stretch' },
  chip: { paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.lg },
});
