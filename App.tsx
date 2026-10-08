import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import GameScreen, { BACKGROUND } from './src/GameScreen';

// Keep the splash up until the game has drawn its first frame (it posts 'ready').
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 250, fade: true });

export default function App() {
  useEffect(() => {
    // Never strand the player on the splash screen if the page fails to report in.
    const timer = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 6000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics} style={{ flex: 1, backgroundColor: BACKGROUND }}>
      <StatusBar style="dark" />
      <GameScreen />
    </SafeAreaProvider>
  );
}
