import { useColorScheme } from 'react-native';

/** Spacing and type scales step by the golden ratio (~1.618). */
export const space = { xs: 4, sm: 6, md: 10, lg: 16, xl: 26, xxl: 42 } as const;
export const font = { xs: 12, sm: 14, md: 16, lg: 20, xl: 26 } as const;
export const radius = { sm: 6, md: 10, lg: 16 } as const;

const light = {
  bg: '#F3F5F4',
  surface: '#FFFFFF',
  ink: '#17202B',
  muted: '#5A6572',
  line: '#D9DFDD',
  accent: '#2447B8',
  accentInk: '#FFFFFF',
  accentSoft: '#E4E9FA',
  success: '#1E7A55',
  warn: '#B06A10',
  warnSoft: '#FBF0DF',
  danger: '#B3261E',
};

const dark: typeof light = {
  bg: '#10151C',
  surface: '#171E27',
  ink: '#E7ECF0',
  muted: '#98A3AF',
  line: '#2A333E',
  accent: '#8CA6FF',
  accentInk: '#0E1530',
  accentSoft: '#1E2A4A',
  success: '#5CC99A',
  warn: '#E9A94B',
  warnSoft: '#2E2413',
  danger: '#F2B8B5',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
