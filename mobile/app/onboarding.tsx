import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { useSQLiteContext } from 'expo-sqlite';
import { setSetting } from '../db/db';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, fonts, spacing } from '../lib/theme';

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
      <Text style={styles.heading}>Welcome to Classroom Log</Text>
      <Text style={styles.paragraph}>
        A note-taking tool for special-education teachers. Tap a student, speak or type, save. Then let Claude draft a daily summary for review.
      </Text>

      <Text style={styles.subhead}>What stays on the phone</Text>
      <Text style={styles.paragraph}>
        Typed notes, transcribed text, settings, and your roster all live in a local database on this device only.
      </Text>

      <Text style={styles.subhead}>What goes to the laptop</Text>
      <Text style={styles.paragraph}>
        When you record a voice note, audio bytes are sent to the builder's laptop just long enough to transcribe; nothing is written to disk. When you generate a summary, the note text is sent to the laptop for Claude. Nothing is retained after each request returns.
      </Text>

      <Text style={styles.subhead}>What goes to third parties</Text>
      <Text style={styles.paragraph}>
        Audio bytes are sent to OpenAI Whisper for transcription; note text is sent to Anthropic Claude for summaries. Both services state they do not retain API inputs for training.
      </Text>

      <View style={styles.actions}>
        <PrimaryButton
          label={micGranted ? 'Microphone allowed' : 'Allow microphone'}
          onPress={requestMic}
          variant={micGranted ? 'secondary' : 'primary'}
          disabled={micGranted}
        />
        <View style={{ height: spacing.md }} />
        <PrimaryButton label="Start using the app" onPress={continueToApp} variant="primary" />
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
