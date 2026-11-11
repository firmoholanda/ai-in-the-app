import { tool, type InferUITools, type UIDataTypes, type UIMessage } from 'ai';
import { z } from 'zod';

/**
 * Tool definitions shared by the API route (runtime) and the app (types only).
 *
 * - getWeather runs on the server (`execute` below).
 * - getDeviceLocation and draftCalendarEvent have no `execute`: the model's call
 *   is streamed to the phone, the app runs it with native APIs and sends the
 *   result back (see src/lib/native-tools.ts).
 */
export const tools = {
  getWeather: tool({
    description:
      'Get the current weather and today’s min/max for a latitude/longitude. Use getDeviceLocation first if the user means "here".',
    inputSchema: z.object({
      latitude: z.number(),
      longitude: z.number(),
      placeName: z.string().describe('Human-readable place name for display'),
    }),
    execute: async ({ latitude, longitude, placeName }) => {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        '&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Weather service returned ${res.status}`);
      const data = await res.json();
      return {
        placeName,
        temperatureC: data.current.temperature_2m as number,
        windKmh: data.current.wind_speed_10m as number,
        weatherCode: data.current.weather_code as number,
        minC: data.daily.temperature_2m_min[0] as number,
        maxC: data.daily.temperature_2m_max[0] as number,
      };
    },
  }),

  getDeviceLocation: tool({
    description:
      'Get the user’s current location from the phone (asks for permission the first time). Returns coordinates and a city name.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      latitude: z.number(),
      longitude: z.number(),
      city: z.string().nullable(),
      country: z.string().nullable(),
    }),
  }),

  draftCalendarEvent: tool({
    description:
      'Draft a calendar event on the phone. The user reviews it in the native calendar sheet and decides whether to save it.',
    inputSchema: z.object({
      title: z.string(),
      startISO: z.string().describe('Start date-time in ISO 8601 with timezone offset'),
      endISO: z.string().describe('End date-time in ISO 8601 with timezone offset'),
      location: z.string().optional(),
      notes: z.string().optional(),
    }),
    outputSchema: z.object({
      status: z.enum(['saved', 'canceled', 'unknown']),
    }),
  }),
};

export type ChatTools = InferUITools<typeof tools>;
export type ChatMessage = UIMessage<never, UIDataTypes, ChatTools>;
