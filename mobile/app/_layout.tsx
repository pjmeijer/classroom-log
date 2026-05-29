import { useEffect, useState } from 'react';
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts, SourceSerif4_600SemiBold, SourceSerif4_400Regular_Italic } from '@expo-google-fonts/source-serif-4';
import { SourceSans3_400Regular, SourceSans3_600SemiBold } from '@expo-google-fonts/source-sans-3';
import { View, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { migrate } from '../db/migrations';
import { getSetting } from '../db/db';
import { colors } from '../lib/theme';
import { cleanupOrphanRecordings } from '../lib/audio';

SplashScreen.preventAutoHideAsync().catch(() => {});

async function onDbInit(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA foreign_keys = ON');
  await migrate(db);
}

function RouterGate({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const done = await getSetting(db, 'onboarding_complete');
      const inOnboarding = segments[0] === 'onboarding';
      if (done !== '1' && !inOnboarding) {
        router.replace('/onboarding');
      }
      setReady(true);
      SplashScreen.hideAsync().catch(() => {});
      cleanupOrphanRecordings(db).catch(() => {});
    })();
  }, [db]);

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
  const [fontsLoaded] = useFonts({
    SourceSerif4_600SemiBold,
    SourceSerif4_400Regular_Italic,
    SourceSans3_400Regular,
    SourceSans3_600SemiBold,
  });

  if (!fontsLoaded) return null;

  return (
    <SQLiteProvider databaseName="classroom-log.db" onInit={onDbInit}>
      <RouterGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      </RouterGate>
    </SQLiteProvider>
  );
}
