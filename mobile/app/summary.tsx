import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { listActiveStudents, getNotesForStudentInLocalRange, getSetting, Student } from '../db/db';
import { fetchSummary, SummarySections } from '../api/summary';
import { DEFAULT_API_BASE_URL } from '../api/config';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, fonts, spacing, radii, shadows } from '../lib/theme';
import { localYmd } from '../lib/dates';

export default function Summary() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [ymd, setYmd] = useState<string>(localYmd());
  const [llmEnabled, setLlmEnabled] = useState(true);
  const [apiUrl, setApiUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<SummarySections | null>(null);
  const [rawNotes, setRawNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const list = await listActiveStudents(db);
      setStudents(list);
      setStudentId(list[0]?.id ?? null);
      setApiUrl((await getSetting(db, 'api_base_url')) || DEFAULT_API_BASE_URL);
      setLlmEnabled((await getSetting(db, 'llm_enabled')) !== '0');
    })();
  }, [db]);

  function selectStudent(id: string) {
    setSections(null);
    setRawNotes('');
    setErrorMsg(null);
    setStudentId(id);
  }

  async function generate() {
    if (!studentId) return;
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const notes = await getNotesForStudentInLocalRange(db, studentId, ymd, ymd);
    if (notes.length === 0) {
      Alert.alert('No notes', `No notes for ${student.name} on the selected day.`);
      return;
    }
    setRawNotes(notes.map(n => `${new Date(n.created_at).toLocaleTimeString()} — ${n.text}`).join('\n\n'));
    if (!llmEnabled) {
      setSections(null);
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    const r = await fetchSummary(apiUrl, student.name, notes.map(n => ({ ts: n.created_at, text: n.text })));
    setLoading(false);
    if (r.ok) setSections(r.sections);
    else setErrorMsg(`${r.error.code}: ${r.error.message}`);
  }

  async function copyAll() {
    if (!sections) {
      await Clipboard.setStringAsync(rawNotes);
      return;
    }
    const out = `Positives — Draft, review before sharing\n${sections.positives}\n\nConcerns — Draft, review before sharing\n${sections.concerns}\n\nPatterns — Draft, review before sharing\n${sections.patterns}\n\nSuggested next steps — Draft, review before sharing\n${sections.next_steps}`;
    await Clipboard.setStringAsync(out);
    Alert.alert('Copied', 'Summary copied to clipboard.');
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
        <Text style={styles.h1}>Draft summary</Text>

        <View style={styles.pickerRow}>
          <View style={styles.pickerCol}>
            <Text style={styles.pickerLabel}>Student</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {students.map(s => (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Select student ${s.name}`}
                  accessibilityState={{ selected: studentId === s.id }}
                  onPress={() => selectStudent(s.id)}
                  style={[styles.chip, studentId === s.id && styles.chipOn]}
                >
                  <Text style={[styles.chipLabel, studentId === s.id && styles.chipLabelOn]}>{s.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
        <Text style={styles.dateNote}>Date: {ymd.slice(0,4)}-{ymd.slice(4,6)}-{ymd.slice(6,8)} (today)</Text>

        <View style={{ marginTop: spacing.md }}>
          <PrimaryButton label={loading ? 'Generating…' : 'Generate'} onPress={generate} variant="primary" disabled={loading || !studentId} />
        </View>

        {!llmEnabled && (
          <Text style={styles.banner}>AI summaries are off. Showing your raw notes.</Text>
        )}

        {loading && <ActivityIndicator style={{ marginTop: spacing.xl }} />}
        {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

        {sections && (
          <View>
            {(['positives', 'concerns', 'patterns', 'next_steps'] as const).map((k) => (
              <View key={k} style={styles.section}>
                <Text style={styles.sectionTitle}>{({positives:'Positives',concerns:'Concerns',patterns:'Patterns',next_steps:'Suggested next steps'} as any)[k]}</Text>
                <Text style={styles.draft}>Draft — review before sharing</Text>
                <Text style={styles.sectionBody}>{sections[k]}</Text>
              </View>
            ))}
          </View>
        )}

        {!sections && rawNotes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Raw notes</Text>
            <Text style={styles.sectionBody}>{rawNotes}</Text>
          </View>
        )}

        {(sections || rawNotes) && (
          <View style={{ marginTop: spacing.lg }}>
            <PrimaryButton label="Copy all" onPress={copyAll} variant="secondary" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.heading, fontSize: 26, color: colors.ink, marginBottom: spacing.md },
  pickerRow: { marginBottom: spacing.sm },
  pickerCol: {},
  pickerLabel: { fontFamily: fonts.headingItalic, fontSize: 12, color: colors.inkMuted, marginBottom: spacing.xs },
  chip: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginRight: spacing.sm },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipLabel: { fontFamily: fonts.heading, fontSize: 14, color: colors.ink },
  chipLabelOn: { color: colors.accentText },
  dateNote: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, marginTop: spacing.sm },
  banner: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, backgroundColor: colors.surface2, padding: spacing.sm, borderRadius: radii.sm, marginTop: spacing.md, textAlign: 'center' },
  error: { fontFamily: fonts.body, color: colors.danger, marginTop: spacing.lg, textAlign: 'center' },
  section: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.md, ...shadows.soft },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.ink },
  draft: { fontFamily: fonts.headingItalic, fontSize: 11, color: colors.inkMuted, marginBottom: spacing.sm },
  sectionBody: { fontFamily: fonts.body, fontSize: 14, color: colors.ink, lineHeight: 21 },
});
