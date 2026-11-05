import * as Haptics from 'expo-haptics';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { type ComponentType, type Ref, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { COLORS, LOCK_AFTER_MS, SITE_URL } from './config';
import { INJECTED_BEFORE_LOAD, opensOutside, parseWebMessage } from './links';
import { biometricsAvailable, shouldRelock, unlock } from './lock';
import { DEFAULT_PREFS, loadPrefs, savePrefs, shouldOfferSetup, type Prefs } from './prefs';
import { cancelDailyReminder, configureNotifications, ensurePermission, scheduleDailyReminder } from './reminders';
import { SettingsSheet } from './SettingsSheet';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// react-native-webview's class typings don't line up with React 19's JSX types; the runtime is fine.
const Web = WebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebView> }>;

export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}

function Shell() {
  const web = useRef<WebView>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [biometrics, setBiometrics] = useState(false);
  const [locked, setLocked] = useState(false);
  const [offline, setOffline] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [intro, setIntro] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const backgroundedAt = useRef<number | null>(null);

  // first load: prefs, biometrics, launch count, lock if needed
  useEffect(() => {
    configureNotifications();
    void (async () => {
      const [p, bio] = await Promise.all([loadPrefs(), biometricsAvailable()]);
      const next = { ...p, launches: p.launches + 1 };
      setBiometrics(bio);
      setPrefs(next);
      if (next.lockEnabled && bio) setLocked(true);
      if (shouldOfferSetup(next)) {
        setIntro(true);
        setSettingsOpen(true);
        next.askedOnce = true;
      }
      await savePrefs(next).catch(() => undefined);
    })();
  }, []);

  // relock after a minute in the background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') backgroundedAt.current = Date.now();
      if (s === 'active') {
        if (prefs?.lockEnabled && biometrics && shouldRelock(backgroundedAt.current, Date.now(), LOCK_AFTER_MS)) setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [prefs?.lockEnabled, biometrics]);

  const tryUnlock = useCallback(async () => {
    if (await unlock()) setLocked(false);
  }, []);

  useEffect(() => {
    if (locked) void tryUnlock();
  }, [locked, tryUnlock]);

  const update = async (patch: Partial<Prefs>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await savePrefs(next).catch(() => undefined);
  };

  const onToggleLock = async (on: boolean) => {
    setMessage(null);
    if (on) {
      setBusy(true);
      const ok = await unlock(); // prove it works before turning it on
      setBusy(false);
      if (!ok) return;
    }
    void Haptics.selectionAsync();
    await update({ lockEnabled: on });
  };

  const onToggleReminder = async (on: boolean) => {
    setMessage(null);
    setBusy(true);
    try {
      if (on) {
        if (!(await ensurePermission())) {
          setMessage('ההתראות חסומות לאפליקציה. אפשר לאשר אותן בהגדרות הטלפון ← הכיס המשפחתי ← עדכונים.');
          return;
        }
        await scheduleDailyReminder(prefs?.reminderTime ?? DEFAULT_PREFS.reminderTime);
      } else {
        await cancelDailyReminder();
      }
      void Haptics.selectionAsync();
      await update({ reminderEnabled: on });
    } finally {
      setBusy(false);
    }
  };

  const onPickTime = async (time: string) => {
    setBusy(true);
    try {
      await scheduleDailyReminder(time);
      await update({ reminderTime: time });
    } finally {
      setBusy(false);
    }
  };

  const onMessage = async (e: WebViewMessageEvent) => {
    const m = parseWebMessage(e.nativeEvent.data);
    if (!m) return;
    if (m.type === 'openSettings') {
      setIntro(false);
      setMessage(null);
      setSettingsOpen(true);
    } else if (m.type === 'share') {
      const text = [m.text, m.url].filter(Boolean).join('\n');
      await Share.share({ title: m.title, message: text || m.title || '', url: m.url }).catch(() => undefined);
    } else if (m.type === 'file') {
      try {
        const file = new File(Paths.cache, m.name);
        if (file.exists) file.delete();
        await file.write(m.text);
        await Sharing.shareAsync(file.uri, { mimeType: m.mime, dialogTitle: m.name, UTI: m.name.endsWith('.csv') ? 'public.comma-separated-values-text' : 'public.plain-text' });
      } catch {
        // the share sheet was closed or the file could not be written — nothing to undo
      }
    }
  };

  const onShouldStart = (req: ShouldStartLoadRequest) => {
    if (opensOutside(req.url, req.isTopFrame ?? true)) {
      void Linking.openURL(req.url).catch(() => undefined);
      return false;
    }
    return true;
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      {offline ? (
        <View style={styles.center}>
          <Text style={styles.offlineTitle}>אין חיבור לאינטרנט</Text>
          <Text style={styles.offlineText}>הכיס המשפחתי צריך רשת כדי לשמור ולסנכרן את הנתונים של כל המשפחה.</Text>
          <Pressable
            style={styles.button}
            accessibilityRole="button"
            onPress={() => {
              setOffline(false);
              web.current?.reload();
            }}
          >
            <Text style={styles.buttonText}>לנסות שוב</Text>
          </Pressable>
        </View>
      ) : (
        <Web
          ref={web}
          source={{ uri: SITE_URL }}
          style={styles.web}
          originWhitelist={['*']}
          injectedJavaScriptBeforeContentLoaded={INJECTED_BEFORE_LOAD}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={onShouldStart}
          onLoadEnd={() => void SplashScreen.hideAsync().catch(() => undefined)}
          onError={() => {
            setOffline(true);
            void SplashScreen.hideAsync().catch(() => undefined);
          }}
          onContentProcessDidTerminate={() => web.current?.reload()}
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.center, StyleSheet.absoluteFill]}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          )}
          pullToRefreshEnabled
          allowsBackForwardNavigationGestures
          sharedCookiesEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          decelerationRate="normal"
          bounces
          textInteractionEnabled
          applicationNameForUserAgent="FamilyPocketApp/1.0"
        />
      )}

      {locked ? (
        <View style={[StyleSheet.absoluteFill, styles.lock]}>
          <Text style={styles.lockTitle}>הכיס המשפחתי נעול</Text>
          <Pressable style={styles.button} accessibilityRole="button" onPress={() => void tryUnlock()}>
            <Text style={styles.buttonText}>פתיחה</Text>
          </Pressable>
        </View>
      ) : null}

      {prefs ? (
        <SettingsSheet
          visible={settingsOpen && !locked}
          prefs={prefs}
          biometrics={biometrics}
          busy={busy}
          message={message}
          intro={intro}
          onClose={() => setSettingsOpen(false)}
          onToggleLock={(v) => void onToggleLock(v)}
          onToggleReminder={(v) => void onToggleReminder(v)}
          onPickTime={(t) => void onPickTime(t)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  web: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16, backgroundColor: COLORS.background },
  offlineTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  offlineText: { fontSize: 16, color: COLORS.muted, textAlign: 'center', lineHeight: 22 },
  button: { backgroundColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  lock: { backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', gap: 20 },
  lockTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text },
});
