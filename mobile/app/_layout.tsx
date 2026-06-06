import React, { useEffect, useState } from 'react';
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts, SourceSerif4_600SemiBold, SourceSerif4_400Regular_Italic } from '@expo-google-fonts/source-serif-4';
import { SourceSans3_400Regular, SourceSans3_600SemiBold } from '@expo-google-fonts/source-sans-3';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { migrate } from '../db/migrations';
import { getSetting } from '../db/db';
import { colors } from '../lib/theme';
import { cleanupOrphanRecordings } from '../lib/audio';

SplashScreen.preventAutoHideAsync().catch(() => {});

// DIAGNOSTIC: temporary instrumentation to surface the white-screen-after-splash
// root cause on TestFlight. Revert this entire block once the JS-mount bug is
// identified. See feat/eas-testflight-impl branch context.
const dx = StyleSheet.create({
  base: { flex: 1, padding: 20, paddingTop: 80 },
  loading: { backgroundColor: '#E07A1A' },
  error: { backgroundColor: '#B0241A' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  body: { color: '#fff', fontSize: 12, marginBottom: 8 },
});

class DiagnosticBoundary extends React.Component<
  { children: React.ReactNode; label: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) {
    SplashScreen.hideAsync().catch(() => {});
    console.error(`[diagnostic ${this.props.label}]`, error);
  }
  render() {
    const e = this.state.error;
    if (e) {
      const msg = String((e as any)?.message ?? e);
      const stack = String((e as any)?.stack ?? '').slice(0, 800);
      return (
        <ScrollView style={[dx.base, dx.error]}>
          <Text style={dx.title}>{this.props.label}</Text>
          <Text style={dx.body}>{msg}</Text>
          <Text style={dx.body}>{stack}</Text>
        </ScrollView>
      );
    }
    return <>{this.props.children}</>;
  }
}

async function onDbInit(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA foreign_keys = ON');
  await migrate(db);
}

function RouterGate({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const done = await getSetting(db, 'onboarding_complete');
        const inOnboarding = segments[0] === 'onboarding';
        if (done !== '1' && !inOnboarding) {
          router.replace('/onboarding');
        }
        setReady(true);
        SplashScreen.hideAsync().catch(() => {});
        cleanupOrphanRecordings(db).catch(() => {});
      } catch (e) {
        SplashScreen.hideAsync().catch(() => {});
        setError(e as Error);
      }
    })();
  }, [db]);

  if (error) {
    const msg = String((error as any)?.message ?? error);
    const stack = String((error as any)?.stack ?? '').slice(0, 800);
    return (
      <ScrollView style={[dx.base, dx.error]}>
        <Text style={dx.title}>ROUTER GATE ERROR</Text>
        <Text style={dx.body}>{msg}</Text>
        <Text style={dx.body}>{stack}</Text>
      </ScrollView>
    );
  }

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SourceSerif4_600SemiBold,
    SourceSerif4_400Regular_Italic,
    SourceSans3_400Regular,
    SourceSans3_600SemiBold,
  });
  const [forceShowDiag, setForceShowDiag] = useState(false);

  // DIAGNOSTIC: force-hide splash after 1.5s so on-screen diagnostic state is visible
  // even if the font/db/router chain hangs silently.
  useEffect(() => {
    const t = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
      setForceShowDiag(true);
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontError]);

  if (fontError) {
    const msg = String((fontError as any)?.message ?? fontError);
    const stack = String((fontError as any)?.stack ?? '').slice(0, 800);
    return (
      <ScrollView style={[dx.base, dx.error]}>
        <Text style={dx.title}>FONT ERROR</Text>
        <Text style={dx.body}>{msg}</Text>
        <Text style={dx.body}>{stack}</Text>
      </ScrollView>
    );
  }

  if (!fontsLoaded) {
    if (!forceShowDiag) return null;
    return (
      <View style={[dx.base, dx.loading]}>
        <Text style={dx.title}>Loading fonts...</Text>
        <Text style={dx.body}>useFonts is still pending after 1.5s.</Text>
      </View>
    );
  }

  return (
    <DiagnosticBoundary label="DB/ROUTER CRASHED">
      <SQLiteProvider databaseName="classroom-log.db" onInit={onDbInit}>
        <RouterGate>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="note/[studentId]" options={{ presentation: 'modal' }} />
          </Stack>
        </RouterGate>
      </SQLiteProvider>
    </DiagnosticBoundary>
  );
}
