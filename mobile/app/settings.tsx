import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Switch, Alert, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listActiveStudents, addStudent, archiveStudent, setStudentVoiceAllowed, getSetting, setSetting, Student } from '../db/db';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, fonts, spacing, radii, shadows } from '../lib/theme';
import Constants from 'expo-constants';
import { DEFAULT_API_BASE_URL } from '../api/config';

export default function Settings() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [newName, setNewName] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [llmEnabled, setLlmEnabled] = useState(true);
  const [healthStatus, setHealthStatus] = useState<string>('not tested');

  const reload = useCallback(async () => {
    setStudents(await listActiveStudents(db));
    setApiUrl((await getSetting(db, 'api_base_url')) || DEFAULT_API_BASE_URL);
    setLlmEnabled((await getSetting(db, 'llm_enabled')) !== '0');
  }, [db]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const counts = students.reduce<Record<string, number>>((acc, s) => {
    acc[s.name] = (acc[s.name] || 0) + 1;
    return acc;
  }, {});

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await addStudent(db, { name: trimmed });
    setNewName('');
    reload();
  }

  function confirmArchive(s: Student) {
    Alert.alert(
      `Archive ${s.name}?`,
      'Their notes remain in the database. They no longer appear in the roster.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', style: 'destructive', onPress: async () => { await archiveStudent(db, s.id); reload(); } },
      ],
    );
  }

  async function saveApiUrl() {
    await setSetting(db, 'api_base_url', apiUrl.trim());
    Alert.alert('Saved', 'API base URL updated.');
  }

  async function testConnection() {
    try {
      setHealthStatus('checking…');
      const r = await fetch(`${apiUrl.trim()}/health`, { method: 'GET' });
      const body = await r.json();
      setHealthStatus(body.ok ? 'connected' : `degraded (anthropic=${body.anthropic_ok}, openai=${body.openai_ok})`);
    } catch (e: any) {
      setHealthStatus(`error: ${e.message}`);
    }
  }

  function confirmReset() {
    Alert.alert(
      'Reset demo data?',
      'All students and notes will be permanently deleted from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await db.execAsync('DELETE FROM notes; DELETE FROM students; DELETE FROM settings WHERE key NOT IN (\'onboarding_complete\', \'api_base_url\')');
            reload();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl * 2 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          onPress={() => router.back()}
          style={{ marginBottom: spacing.md }}
        >
          <Text style={{ fontFamily: fonts.body, color: colors.accent }}>← Back</Text>
        </Pressable>
        <Text style={styles.h1}>Settings</Text>

        <Text style={styles.sectionHead}>Students</Text>
        <View style={styles.addRow}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Student name"
            placeholderTextColor={colors.inkMuted}
            style={styles.input}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <PrimaryButton label="Add" onPress={handleAdd} variant="primary" />
        </View>
        {students.map((s) => (
          <View key={s.id} style={styles.studentRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.studentName}>{s.name}</Text>
              {counts[s.name] > 1 && <Text style={styles.warn}>⚠ duplicate name</Text>}
            </View>
            <Switch
              value={s.recording_enabled === 1}
              onValueChange={async (v) => { await setStudentVoiceAllowed(db, s.id, v); reload(); }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Archive student ${s.name}`}
              onPress={() => confirmArchive(s)}
              style={styles.archiveBtn}
            >
              <Text style={{ color: colors.danger, fontFamily: fonts.body }}>Archive</Text>
            </Pressable>
          </View>
        ))}

        <Text style={styles.sectionHead}>AI</Text>
        <View style={styles.aiRow}>
          <Text style={styles.aiLabel}>Generate summaries with Claude</Text>
          <Switch value={llmEnabled} onValueChange={async (v) => { await setSetting(db, 'llm_enabled', v ? '1' : '0'); setLlmEnabled(v); }} />
        </View>

        <Text style={styles.sectionHead}>Server</Text>
        <TextInput value={apiUrl} onChangeText={setApiUrl} placeholder="https://your-tunnel.ngrok.app" autoCapitalize="none" style={styles.input} />
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          <View style={{ flex: 1 }}><PrimaryButton label="Save URL" onPress={saveApiUrl} variant="secondary" /></View>
          <View style={{ flex: 1 }}><PrimaryButton label="Test connection" onPress={testConnection} variant="ghost" /></View>
        </View>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, marginTop: spacing.sm }}>Status: {healthStatus}</Text>

        <Text style={styles.sectionHead}>Demo</Text>
        <PrimaryButton label="Reset demo data" onPress={confirmReset} variant="ghost" />

        <Text style={styles.sectionHead}>About</Text>
        <Text style={styles.aboutLine}>Version {Constants.expoConfig?.version ?? '0.1.0'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.heading, fontSize: 26, color: colors.ink, marginBottom: spacing.md },
  sectionHead: { fontFamily: fonts.headingItalic, fontSize: 14, color: colors.ink, marginTop: spacing.xl, marginBottom: spacing.sm },
  addRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.md },
  input: { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.body, color: colors.ink, fontSize: 14, ...shadows.soft },
  studentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  studentName: { fontFamily: fonts.heading, fontSize: 15, color: colors.ink },
  warn: { fontFamily: fonts.body, fontSize: 11, color: colors.danger, marginTop: 2 },
  archiveBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  aiRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  aiLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.ink, flex: 1 },
  aboutLine: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted },
});
