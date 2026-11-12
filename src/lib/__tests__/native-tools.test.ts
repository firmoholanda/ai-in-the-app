import * as Calendar from 'expo-calendar';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { draftCalendarEvent, getDeviceLocation } from '../native-tools';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));

jest.mock('expo-calendar', () => ({
  requestCalendarPermissions: jest.fn(),
  getDefaultCalendarSync: jest.fn(),
  getCalendars: jest.fn(),
}));

const location = jest.mocked(Location);
const calendar = jest.mocked(Calendar);

beforeEach(() => jest.resetAllMocks());

describe('getDeviceLocation', () => {
  const coords = { latitude: 37.77, longitude: -122.42 };

  it('throws when permission is denied', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);
    await expect(getDeviceLocation()).rejects.toThrow('Location permission was not granted.');
  });

  it('prefers the last known position and reverse geocodes it', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    location.getLastKnownPositionAsync.mockResolvedValue({ coords } as never);
    location.reverseGeocodeAsync.mockResolvedValue([{ city: 'San Francisco', country: 'United States' }] as never);

    await expect(getDeviceLocation()).resolves.toEqual({ ...coords, city: 'San Francisco', country: 'United States' });
    expect(location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('requests a fresh position when nothing is cached', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    location.getLastKnownPositionAsync.mockResolvedValue(null);
    location.getCurrentPositionAsync.mockResolvedValue({ coords } as never);
    location.reverseGeocodeAsync.mockResolvedValue([] as never);

    const result = await getDeviceLocation();
    expect(location.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: Location.Accuracy.Balanced });
    expect(result).toEqual({ ...coords, city: null, country: null });
  });

  it('falls back to the subregion when there is no city', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    location.getLastKnownPositionAsync.mockResolvedValue({ coords } as never);
    location.reverseGeocodeAsync.mockResolvedValue([{ city: null, subregion: 'Bay Area', country: 'US' }] as never);

    await expect(getDeviceLocation()).resolves.toMatchObject({ city: 'Bay Area', country: 'US' });
  });

  it('still returns coordinates when reverse geocoding fails (offline)', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    location.getLastKnownPositionAsync.mockResolvedValue({ coords } as never);
    location.reverseGeocodeAsync.mockRejectedValue(new Error('network'));

    await expect(getDeviceLocation()).resolves.toEqual({ ...coords, city: null, country: null });
  });
});

describe('draftCalendarEvent', () => {
  const event = {
    title: 'Focus block',
    startISO: '2026-11-12T10:00:00+00:00',
    endISO: '2026-11-12T10:30:00+00:00',
  };
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it.each([
    ['an unparseable start', { ...event, startISO: 'tomorrow-ish' }, 'invalid start or end date'],
    ['an unparseable end', { ...event, endISO: '' }, 'invalid start or end date'],
    ['an end before the start', { ...event, endISO: '2026-11-12T09:00:00+00:00' }, 'must end after it starts'],
  ])('rejects %s without asking for permission', async (_name, bad, message) => {
    await expect(draftCalendarEvent(bad)).rejects.toThrow(message);
    expect(calendar.requestCalendarPermissions).not.toHaveBeenCalled();
  });

  it('throws when calendar permission is denied', async () => {
    calendar.requestCalendarPermissions.mockResolvedValue({ status: 'denied' } as never);
    await expect(draftCalendarEvent(event)).rejects.toThrow('Calendar permission was not granted.');
  });

  describe('on iOS', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
      calendar.requestCalendarPermissions.mockResolvedValue({ status: 'granted' } as never);
    });

    it('opens the native form with the event dates', async () => {
      const addEventWithForm = jest.fn().mockResolvedValue({ action: 'saved' });
      calendar.getDefaultCalendarSync.mockReturnValue({ addEventWithForm } as never);

      await draftCalendarEvent({ ...event, location: 'Desk', notes: 'Deep work' });

      expect(addEventWithForm).toHaveBeenCalledWith({
        title: 'Focus block',
        startDate: new Date('2026-11-12T10:00:00Z'),
        endDate: new Date('2026-11-12T10:30:00Z'),
        location: 'Desk',
        notes: 'Deep work',
      });
    });

    it.each([
      ['saved', 'saved'],
      ['canceled', 'canceled'],
      ['deleted', 'unknown'],
    ])('maps the form action "%s" to status "%s"', async (action, status) => {
      calendar.getDefaultCalendarSync.mockReturnValue({
        addEventWithForm: jest.fn().mockResolvedValue({ action }),
      } as never);
      await expect(draftCalendarEvent(event)).resolves.toEqual({ status });
    });
  });

  describe('on Android', () => {
    beforeEach(() => {
      Platform.OS = 'android';
      calendar.requestCalendarPermissions.mockResolvedValue({ status: 'granted' } as never);
    });

    it('creates the event in the primary writable calendar', async () => {
      const primary = { isPrimary: true, allowsModifications: true, createEvent: jest.fn() };
      const other = { isPrimary: false, allowsModifications: true, createEvent: jest.fn() };
      calendar.getCalendars.mockResolvedValue([other, primary] as never);

      await expect(draftCalendarEvent(event)).resolves.toEqual({ status: 'saved' });
      expect(primary.createEvent).toHaveBeenCalledTimes(1);
      expect(other.createEvent).not.toHaveBeenCalled();
    });

    it('falls back to any writable calendar', async () => {
      const readOnly = { isPrimary: true, allowsModifications: false, createEvent: jest.fn() };
      const writable = { isPrimary: false, allowsModifications: true, createEvent: jest.fn() };
      calendar.getCalendars.mockResolvedValue([readOnly, writable] as never);

      await draftCalendarEvent(event);
      expect(writable.createEvent).toHaveBeenCalledTimes(1);
      expect(readOnly.createEvent).not.toHaveBeenCalled();
    });

    it('throws when no calendar is writable', async () => {
      calendar.getCalendars.mockResolvedValue([{ isPrimary: true, allowsModifications: false }] as never);
      await expect(draftCalendarEvent(event)).rejects.toThrow('No writable calendar found on this device.');
    });
  });
});
