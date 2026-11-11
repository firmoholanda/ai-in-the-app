import Constants from 'expo-constants';

/**
 * Absolute URL for an API route. In development the routes are served by the
 * Expo dev server the app is already connected to; in production they live
 * wherever you deployed them (EXPO_PUBLIC_API_BASE_URL).
 */
export function apiUrl(path: string) {
  if (process.env.NODE_ENV === 'development') {
    const origin = Constants.experienceUrl.replace('exp://', 'http://');
    return origin.concat(path);
  }
  const base = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!base) throw new Error('Set EXPO_PUBLIC_API_BASE_URL to the deployed API origin.');
  return base.concat(path);
}
