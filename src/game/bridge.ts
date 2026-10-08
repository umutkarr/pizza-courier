import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// Messages posted by web/index.html through window.ReactNativeWebView.postMessage.
export type HapticKind = 'selection' | 'light' | 'medium' | 'success';
export type GameMessage =
  | { type: 'ready' }
  | { type: 'save'; data: unknown }
  | { type: 'haptic'; kind: HapticKind }
  | { type: 'error'; message: string; at?: string };

export type Insets = { top: number; right: number; bottom: number; left: number };

// Read by the page before any of its own code runs, as window.__PC_NATIVE__.
export type NativeBoot = {
  save: unknown;
  insets: Insets;
  version: string | null;
  build: string | null;
  platform: string;
  dev: boolean;
};

const SAVE_KEY = 'pizzaCourier.save';

export function parseMessage(raw: string): GameMessage | null {
  try {
    const msg = JSON.parse(raw);
    return msg && typeof msg.type === 'string' ? (msg as GameMessage) : null;
  } catch {
    return null;
  }
}

export async function loadSave(): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeSave(data: unknown): void {
  AsyncStorage.setItem(SAVE_KEY, JSON.stringify(data)).catch(() => {});
}

export function playHaptic(kind: HapticKind): void {
  const done = () => {};
  switch (kind) {
    case 'selection':
      Haptics.selectionAsync().catch(done);
      break;
    case 'light':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(done);
      break;
    case 'medium':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(done);
      break;
    case 'success':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(done);
      break;
  }
}

export const roundInsets = (i: Insets): Insets => ({
  top: Math.round(i.top),
  right: Math.round(i.right),
  bottom: Math.round(i.bottom),
  left: Math.round(i.left),
});

export const bootScript = (boot: NativeBoot) => `window.__PC_NATIVE__ = ${JSON.stringify(boot)}; true;`;
