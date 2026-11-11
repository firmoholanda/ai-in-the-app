import Constants from 'expo-constants';
import { NativeModules } from 'react-native';

import { apiUrl } from '../api-url';

// A plain mutable object so each test can set what the app would see at runtime.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: null, experienceUrl: undefined } }));

const constants = Constants as unknown as {
  expoConfig: { hostUri?: string } | null;
  experienceUrl?: string;
};
const sourceCode = NativeModules as { SourceCode?: { scriptURL?: string } };

const env = process.env as Record<string, string | undefined>;
const original = {
  NODE_ENV: env.NODE_ENV,
  base: env.EXPO_PUBLIC_API_BASE_URL,
  expoConfig: constants.expoConfig,
  experienceUrl: constants.experienceUrl,
  sourceCode: sourceCode.SourceCode,
};

beforeEach(() => {
  env.NODE_ENV = 'development';
  delete env.EXPO_PUBLIC_API_BASE_URL;
  constants.expoConfig = null;
  constants.experienceUrl = undefined;
  sourceCode.SourceCode = { scriptURL: undefined };
});

afterAll(() => {
  env.NODE_ENV = original.NODE_ENV;
  env.EXPO_PUBLIC_API_BASE_URL = original.base;
  constants.expoConfig = original.expoConfig;
  constants.experienceUrl = original.experienceUrl;
  sourceCode.SourceCode = original.sourceCode;
});

describe('apiUrl in development', () => {
  it('uses the origin of the bundle the app was loaded from', () => {
    sourceCode.SourceCode = { scriptURL: 'http://192.168.0.5:8081/index.bundle?platform=ios&dev=true' };
    expect(apiUrl('/api/chat')).toBe('http://192.168.0.5:8081/api/chat');
  });

  it('falls back to expoConfig.hostUri', () => {
    constants.expoConfig = { hostUri: '10.0.0.2:8081' };
    expect(apiUrl('/api/chat')).toBe('http://10.0.0.2:8081/api/chat');
  });

  it('falls back to experienceUrl and rewrites exp:// to http://', () => {
    constants.experienceUrl = 'exp://10.0.0.3:8081';
    expect(apiUrl('/api/chat')).toBe('http://10.0.0.3:8081/api/chat');
  });

  it('does not crash when experienceUrl is undefined (development builds)', () => {
    env.EXPO_PUBLIC_API_BASE_URL = 'https://example.expo.app';
    expect(() => apiUrl('/api/chat')).not.toThrow();
  });

  it('uses EXPO_PUBLIC_API_BASE_URL when the dev server cannot be detected', () => {
    env.EXPO_PUBLIC_API_BASE_URL = 'https://example.expo.app';
    expect(apiUrl('/api/chat')).toBe('https://example.expo.app/api/chat');
  });

  it('throws a helpful error when nothing is available', () => {
    expect(() => apiUrl('/api/chat')).toThrow(/EXPO_PUBLIC_API_BASE_URL/);
  });
});

describe('apiUrl in production', () => {
  beforeEach(() => {
    env.NODE_ENV = 'production';
  });

  it('uses EXPO_PUBLIC_API_BASE_URL', () => {
    env.EXPO_PUBLIC_API_BASE_URL = 'https://ai-in-the-app.expo.app';
    expect(apiUrl('/api/chat')).toBe('https://ai-in-the-app.expo.app/api/chat');
  });

  it('ignores the dev server even if one is detectable', () => {
    env.EXPO_PUBLIC_API_BASE_URL = 'https://ai-in-the-app.expo.app';
    sourceCode.SourceCode = { scriptURL: 'http://localhost:8081/index.bundle' };
    expect(apiUrl('/x')).toBe('https://ai-in-the-app.expo.app/x');
  });

  it('throws when the base URL is not set', () => {
    expect(() => apiUrl('/api/chat')).toThrow('Set EXPO_PUBLIC_API_BASE_URL');
  });
});
