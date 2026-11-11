import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { font, radius, space, useColors } from '@/theme';
import React from 'react';

type Props = {
  icon: string;
  title: string;
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error' | string;
  detail?: string;
  errorText?: string;
};

/** One card per tool call, so the user can see what the assistant did on their phone. */
export function ToolCard({ icon, title, state, detail, errorText }: Props) {
  const c = useColors();
  const running = state === 'input-streaming' || state === 'input-available';
  const failed = state === 'output-error';

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: failed ? c.warnSoft : c.accentSoft, borderColor: failed ? c.warn : c.line },
      ]}
      accessibilityRole="summary"
    >
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.body}>
        <Text style={[styles.title, { color: c.ink }]}>{title}</Text>
        {failed ? (
          <Text style={[styles.detail, { color: c.warn }]}>{errorText ?? 'Something went wrong.'}</Text>
        ) : detail ? (
          <Text style={[styles.detail, { color: c.muted }]}>{detail}</Text>
        ) : null}
      </View>
      {running ? <ActivityIndicator size="small" color={c.accent} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: { fontSize: font.lg },
  body: { flex: 1, gap: 2 },
  title: { fontSize: font.sm, fontWeight: '600' },
  detail: { fontSize: font.xs },
});
