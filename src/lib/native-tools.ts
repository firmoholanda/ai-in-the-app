import * as Calendar from 'expo-calendar';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

/** Runs getDeviceLocation on the phone. */
export async function getDeviceLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission was not granted.');

  const position =
    (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 })) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  const { latitude, longitude } = position.coords;

  // Reverse geocoding needs the network; coordinates alone are still useful offline.
  let city: string | null = null;
  let country: string | null = null;
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    city = place?.city ?? place?.subregion ?? null;
    country = place?.country ?? null;
  } catch {}

  return { latitude, longitude, city, country };
}

type DraftEvent = {
  title: string;
  startISO: string;
  endISO: string;
  location?: string;
  notes?: string;
};

/**
 * Runs draftCalendarEvent on the phone.
 * iOS: opens the native "new event" sheet so the user stays in control.
 * Android: there is no system default calendar, so the event goes into the
 * primary writable calendar.
 */
export async function draftCalendarEvent(event: DraftEvent) {
  const { status } = await Calendar.requestCalendarPermissions(true);
  if (status !== 'granted') throw new Error('Calendar permission was not granted.');

  const details = {
    title: event.title,
    startDate: new Date(event.startISO),
    endDate: new Date(event.endISO),
    location: event.location,
    notes: event.notes,
  };

  if (Platform.OS === 'ios') {
    const result = await Calendar.getDefaultCalendarSync().addEventWithForm(details);
    const action = result.action as string;
    return { status: action === 'saved' ? 'saved' : action === 'canceled' ? 'canceled' : 'unknown' } as const;
  }

  const calendars = await Calendar.getCalendars();
  const target = calendars.find((c) => c.isPrimary && c.allowsModifications) ?? calendars.find((c) => c.allowsModifications);
  if (!target) throw new Error('No writable calendar found on this device.');
  await target.createEvent(details);
  return { status: 'saved' } as const;
}
