import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { useSQLiteContext } from 'expo-sqlite';
import { setSetting } from '../db/db';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, fonts, spacing } from '../lib/theme';
import { copy } from '../lib/copy';

export default function Onboarding() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [micGranted, setMicGranted] = useState(false);

  async function requestMic() {
    const status = await requestRecordingPermissionsAsync();
    setMicGranted(status.granted);
    if (!status.granted) {
      Alert.alert(
        'Mic disabled',
        'Voice capture will be unavailable. You can still type notes. Enable the microphone for this app in iOS or Android Settings later.',
      );
    }
  }

  async function continueToApp() {
    await setSetting(db, 'onboarding_complete', '1');
    router.replace('/');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{copy.onboardingTitle}</Text>

      <Text style={styles.paragraph}>
        {copy.privacyDisclosureBody}
      </Text>

      <Text style={styles.paragraph}>
        {copy.privacyDisclosureBody2}
      </Text>

      <Text style={styles.paragraph}>
        {copy.onboardingGestureLine}
      </Text>

      <View style={styles.actions}>
        <PrimaryButton
          label={micGranted ? copy.allowMicrophone : copy.allowMicrophone}
          onPress={requestMic}
          variant={micGranted ? 'secondary' : 'primary'}
          disabled={micGranted}
        />
        <View style={{ height: spacing.md }} />
        <PrimaryButton label={copy.startUsingApp} onPress={continueToApp} variant="primary" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.bg, flex: 1 },
  content: { padding: spacing.xl, paddingTop: spacing.xxl },
  heading: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink, marginBottom: spacing.lg },
  subhead: { fontFamily: fonts.headingItalic, fontSize: 16, color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.xs },
  paragraph: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink, marginBottom: spacing.md },
  actions: { marginTop: spacing.xl, marginBottom: spacing.xxl },
});
