import * as Application from 'expo-application';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { bootScript, loadSave, parseMessage, playHaptic, roundInsets, storeSave, type Insets } from './game/bridge';
import { GAME_HTML } from './game/gameHtml.generated';

export const BACKGROUND = '#f3efe5';

// The page is loaded from a string; this origin only scopes its storage and Web Worker. Nothing is fetched from it.
const BASE_URL = 'https://localhost/pizza-courier/';
const INTERNAL_URL = /^(https:\/\/localhost\/pizza-courier\/|about:|blob:|data:)/;

/** Hosts the canvas game (web/index.html) full screen and bridges saves, haptics and safe-area insets. */
export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const insetsRef = useRef<Insets>(insets);
  useEffect(() => {
    insetsRef.current = insets;   // declared first, so later effects in the same commit see the new value
  }, [insets]);
  const saveRef = useRef<unknown>(null);
  const webRef = useRef<WebView>(null);
  const [boot, setBoot] = useState<{ key: number; script: string } | null>(null);

  const mount = useCallback((key: number) => {
    setBoot({
      key,
      script: bootScript({
        save: saveRef.current,
        insets: roundInsets(insetsRef.current),
        version: Application.nativeApplicationVersion,
        build: Application.nativeBuildVersion,
        platform: Platform.OS,
        dev: __DEV__,
      }),
    });
  }, []);

  useEffect(() => {
    let alive = true;
    loadSave().then(save => {
      if (!alive) return;
      saveRef.current = save;
      mount(0);
    });
    return () => {
      alive = false;
    };
  }, [mount]);

  // Keep the page's HUD clear of the notch and home indicator (rotation, iPad split view).
  const sendInsets = useCallback(() => {
    const msg = JSON.stringify({ insets: roundInsets(insetsRef.current) });
    webRef.current?.injectJavaScript(`window.PC && window.PC.fromNative(${msg}); true;`);
  }, []);
  const { top, right, bottom, left } = roundInsets(insets);
  useEffect(sendInsets, [sendInsets, top, right, bottom, left]);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    const msg = parseMessage(event.nativeEvent.data);
    if (!msg) return;
    switch (msg.type) {
      case 'ready':
        sendInsets();   // in case they changed while the page was loading
        SplashScreen.hideAsync().catch(() => {});
        break;
      case 'save':
        saveRef.current = msg.data;
        storeSave(msg.data);
        break;
      case 'haptic':
        playHaptic(msg.kind);
        break;
      case 'error':
        if (__DEV__) console.warn(`[game] ${msg.message} @${msg.at ?? '?'}`);
        break;
    }
  }, [sendInsets]);

  // iOS may kill a backgrounded web content process; remount with the latest save instead of showing a blank page.
  const restart = useCallback(() => mount((boot?.key ?? 0) + 1), [mount, boot?.key]);

  const onShouldStartLoadWithRequest = useCallback(({ url }: { url: string }) => {
    if (INTERNAL_URL.test(url)) return true;
    Linking.openURL(url).catch(() => {});
    return false;
  }, []);

  if (!boot) return <View style={styles.fill} />;

  return (
    <WebView
      key={boot.key}
      ref={webRef}
      style={styles.fill}
      containerStyle={styles.fill}
      source={{ html: GAME_HTML, baseUrl: BASE_URL }}
      originWhitelist={['*']}
      injectedJavaScriptBeforeContentLoaded={boot.script}
      onMessage={onMessage}
      onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
      onContentProcessDidTerminate={restart}
      onRenderProcessGone={restart}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      textInteractionEnabled={false}
      allowsLinkPreview={false}
      allowsBackForwardNavigationGestures={false}
      dataDetectorTypes="none"
      setSupportMultipleWindows={false}
      setBuiltInZoomControls={false}
      hideKeyboardAccessoryView
      webviewDebuggingEnabled={__DEV__}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: BACKGROUND },
});
