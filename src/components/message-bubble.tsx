import { StyleSheet, Text, View } from 'react-native';

import type { ChatMessage } from '@/lib/tools';
import { font, radius, space, useColors } from '@/theme';

import { ToolCard } from './tool-card';

const WEATHER_LABELS: Record<number, string> = {
  0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'fog',
  51: 'drizzle', 53: 'drizzle', 55: 'drizzle', 61: 'rain', 63: 'rain', 65: 'heavy rain',
  71: 'snow', 73: 'snow', 75: 'heavy snow', 80: 'showers', 81: 'showers', 82: 'heavy showers',
  95: 'thunderstorm', 96: 'thunderstorm', 99: 'thunderstorm',
};

export function MessageBubble({ message }: { message: ChatMessage }) {
  const c = useColors();
  const mine = message.role === 'user';

  return (
    <View style={[styles.row, mine && styles.rowMine]}>
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: c.accent }
            : { backgroundColor: c.surface, borderColor: c.line, borderWidth: StyleSheet.hairlineWidth },
        ]}
      >
        {message.parts.map((part, i) => {
          const key = `${message.id}-${i}`;
          switch (part.type) {
            case 'text':
              return part.text ? (
                <Text key={key} selectable style={[styles.text, { color: mine ? c.accentInk : c.ink }]}>
                  {part.text}
                </Text>
              ) : null;

            case 'tool-getDeviceLocation': {
              const out = part.state === 'output-available' ? part.output : undefined;
              return (
                <ToolCard
                  key={key}
                  icon="📍"
                  title="Your location"
                  state={part.state}
                  errorText={part.state === 'output-error' ? part.errorText : undefined}
                  detail={
                    out
                      ? [out.city, out.country].filter(Boolean).join(', ') ||
                        `${out.latitude.toFixed(3)}, ${out.longitude.toFixed(3)}`
                      : 'Asking the phone…'
                  }
                />
              );
            }

            case 'tool-getWeather': {
              const out = part.state === 'output-available' ? part.output : undefined;
              return (
                <ToolCard
                  key={key}
                  icon="🌤️"
                  title={out ? `Weather in ${out.placeName}` : 'Checking the weather'}
                  state={part.state}
                  errorText={part.state === 'output-error' ? part.errorText : undefined}
                  detail={
                    out
                      ? `${Math.round(out.temperatureC)}°C, ${WEATHER_LABELS[out.weatherCode] ?? 'mixed'} · ${Math.round(out.minC)}° / ${Math.round(out.maxC)}°`
                      : undefined
                  }
                />
              );
            }

            case 'tool-draftCalendarEvent': {
              const input = part.state === 'input-streaming' ? undefined : part.input;
              const out = part.state === 'output-available' ? part.output : undefined;
              const when = input?.startISO
                ? new Date(input.startISO).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                : undefined;
              return (
                <ToolCard
                  key={key}
                  icon="📅"
                  title={input?.title ?? 'Drafting an event'}
                  state={part.state}
                  errorText={part.state === 'output-error' ? part.errorText : undefined}
                  detail={[when, out ? (out.status === 'saved' ? 'Saved' : out.status === 'canceled' ? 'Not saved' : undefined) : 'Waiting for you to confirm']
                    .filter(Boolean)
                    .join(' · ')}
                />
              );
            }

            default:
              return null;
          }
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'flex-start' },
  rowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '85%', gap: space.sm, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.lg },
  text: { fontSize: font.md, lineHeight: Math.round(font.md * 1.5) },
});
