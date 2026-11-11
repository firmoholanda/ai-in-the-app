import Constants from 'expo-constants';
import { NativeModules } from 'react-native';

/**
 * Absolute URL for an API route. In development the routes are served by the
 * Expo dev server the app is already connected to; in production they live
 * wherever you deployed them (EXPO_PUBLIC_API_BASE_URL).
 */
export function apiUrl(path: string) {
  if (process.env.NODE_ENV === 'development') {
    // experienceUrl is undefined in development builds, so prefer hostUri
    // (e.g. "192.168.0.5:8081"), falling back to experienceUrl if present.
    // The bundle is served by the same dev server that serves the API routes.
    const bundleOrigin = /^(https?:\/\/[^/]+)/.exec(NativeModules.SourceCode?.scriptURL ?? '')?.[1];
    const hostUri = Constants.expoConfig?.hostUri;
    const origin =
      bundleOrigin ??
      (hostUri ? `http://${hostUri}` : Constants.experienceUrl?.replace(/^exp:\/\//, 'http://'));
    if (origin) return origin.replace(/\/+$/, '').concat(path);
    const base = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (!base) {
      throw new Error('Could not detect the dev server. Set EXPO_PUBLIC_API_BASE_URL.');
    }
    return base.concat(path);
  }
  const base = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!base) throw new Error('Set EXPO_PUBLIC_API_BASE_URL to the deployed API origin.');
  return base.concat(path);
}
