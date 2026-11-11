import { tools } from '../tools';

const weatherResponse = {
  current: { temperature_2m: 16.2, wind_speed_10m: 10.9, weather_code: 0 },
  daily: { temperature_2m_min: [10.7], temperature_2m_max: [21.4] },
};

type Schema = { safeParse: (value: unknown) => { success: boolean } };
const schemaOf = (tool: { inputSchema: unknown }) => tool.inputSchema as Schema;

describe('getWeather', () => {
  const run = (args: { latitude: number; longitude: number; placeName: string }) =>
    (tools.getWeather.execute as (a: typeof args, o: unknown) => Promise<unknown>)(args, {});

  afterEach(() => jest.restoreAllMocks());

  it('maps the Open-Meteo response', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => weatherResponse,
    } as Response);

    await expect(run({ latitude: 37.77, longitude: -122.42, placeName: 'San Francisco' })).resolves.toEqual({
      placeName: 'San Francisco',
      temperatureC: 16.2,
      windKmh: 10.9,
      weatherCode: 0,
      minC: 10.7,
      maxC: 21.4,
    });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('latitude=37.77');
    expect(url).toContain('longitude=-122.42');
  });

  it('throws when the weather service fails', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 503 } as Response);
    await expect(run({ latitude: 0, longitude: 0, placeName: 'x' })).rejects.toThrow('Weather service returned 503');
  });
});

describe('native tools run on the phone', () => {
  it('have no server-side execute', () => {
    expect('execute' in tools.getDeviceLocation).toBe(false);
    expect('execute' in tools.draftCalendarEvent).toBe(false);
  });
});

describe('draftCalendarEvent input schema', () => {
  const schema = schemaOf(tools.draftCalendarEvent);

  it('accepts a minimal event', () => {
    expect(schema.safeParse({ title: 'x', startISO: '2026-11-12T10:00:00Z', endISO: '2026-11-12T10:30:00Z' }).success).toBe(true);
  });

  it('rejects a missing title or times', () => {
    expect(schema.safeParse({ startISO: 'a', endISO: 'b' }).success).toBe(false);
    expect(schema.safeParse({ title: 'x' }).success).toBe(false);
  });
});

describe('getWeather input schema', () => {
  it('requires numeric coordinates', () => {
    const schema = schemaOf(tools.getWeather);
    expect(schema.safeParse({ latitude: 1, longitude: 2, placeName: 'p' }).success).toBe(true);
    expect(schema.safeParse({ latitude: '1', longitude: 2, placeName: 'p' }).success).toBe(false);
  });
});
