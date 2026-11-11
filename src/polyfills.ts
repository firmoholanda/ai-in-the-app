import { Platform } from 'react-native';
// @ts-expect-error: React Native ships this helper without type declarations.
import { polyfillGlobal } from 'react-native/Libraries/Utilities/PolyfillFunctions';
import structuredClone from '@ungap/structured-clone';
import { TextDecoderStream, TextEncoderStream } from '@stardazed/streams-text-encoding';

// The AI SDK streams responses with web stream APIs that React Native's
// runtime does not provide everywhere yet. Fill only what is missing.
if (Platform.OS !== 'web') {
  if (!('structuredClone' in globalThis)) polyfillGlobal('structuredClone', () => structuredClone);
  if (!('TextEncoderStream' in globalThis)) polyfillGlobal('TextEncoderStream', () => TextEncoderStream);
  if (!('TextDecoderStream' in globalThis)) polyfillGlobal('TextDecoderStream', () => TextDecoderStream);
}
