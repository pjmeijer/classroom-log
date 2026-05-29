import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable } from 'react-native';
import { useRouter, useFocusEffect, Link } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listActiveStudents, getNotesForLocalDate, getSetting, setSetting, Student } from '../db/db';
import { StudentTile } from '../components/StudentTile';
import { NoteRow } from '../components/NoteRow';
import { StatusPill } from '../components/StatusPill';
import { colors, fonts, spacing, radii } from '../lib/theme';
import { localYmd } from '../lib/dates';
import { copy } from '../lib/copy';

export default function Home() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [voiceOn, setVoiceOn] = useState(true);

  const reload = useCallback(async () => {
    setStudents(await listActiveStudents(db));
    setNotes(await getNotesForLocalDate(db, localYmd()));
    setVoiceOn((await getSetting(db, 'voice_on')) !== '0');
  }, [db]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  async function toggleVoice(next: boolean) {
    setVoiceOn(next);
    await setSetting(db, 'voice_on', next ? '1' : '0');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={styles.topBar}>
          <Text style={styles.title}>{copy.appTitle}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <StatusPill ok={true /* wired up in Task 15 */} />
            <Link href="/settings" asChild>
              <Pressable accessibilityRole="button" accessibilityLabel="Settings">
                <Text style={{ fontSize: 20 }}>⚙</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>{copy.voiceOff}</Text>
          <Switch value={!voiceOn} onValueChange={(v) => toggleVoice(!v)} />
        </View>

        <Text style={styles.sectionHead}>{copy.roster}</Text>
        {students.length === 0 ? (
          <Text style={styles.empty}>{copy.emptyRoster}</Text>
        ) : (
          <View style={styles.grid}>
            {students.map((s, i) => (
              <StudentTile key={s.id} name={s.name} index={i} onPress={() => router.push(`/note/${s.id}`)} />
            ))}
          </View>
        )}

        <Text style={styles.sectionHead}>{copy.todaysNotes}</Text>
        {notes.length === 0 ? (
          <Text style={styles.empty}>{copy.emptyNotes}</Text>
        ) : (
          notes.map((n) => (
            <NoteRow key={n.id} studentName={n.student_name} text={n.text} createdAt={n.created_at} onPress={() => router.push(`/note/${n.student_id}?noteId=${n.id}`)} />
          ))
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Generate summary"
        onPress={() => router.push('/summary')}
        style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.85 : 1 }]}
      >
        <Text style={styles.fabLabel}>{copy.generateSummary}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
  rowLabel: { fontFamily: fonts.headingItalic, fontSize: 14, color: colors.ink },
  sectionHead: { fontFamily: fonts.headingItalic, fontSize: 14, color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted, marginBottom: spacing.md },
  fab: { position: 'absolute', bottom: spacing.xl, right: spacing.xl, backgroundColor: colors.accent, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radii.lg, shadowColor: colors.accent, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  fabLabel: { fontFamily: fonts.bodyBold, color: colors.accentText, fontSize: 14 },
});
