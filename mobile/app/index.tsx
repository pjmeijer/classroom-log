import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable, Alert } from 'react-native';
import { useRouter, useFocusEffect, Link } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listActiveStudents, getNotesForLocalDate, getSetting, setSetting, addNote, deleteNote, Student } from '../db/db';
import { StudentTile } from '../components/StudentTile';
import { RecordingTile } from '../components/RecordingTile';
import { NoteRow } from '../components/NoteRow';
import { StatusPill } from '../components/StatusPill';
import { ToastUndoEdit } from '../components/ToastUndoEdit';
import { useCaptureStore } from '../store/useCaptureStore';
import { ensurePermission, useRecorder, startRecording, stopRecording, deleteRecording, discardRecording } from '../lib/audio';
import { fetchTranscript } from '../api/transcribe';
import { DEFAULT_API_BASE_URL } from '../api/config';
import { colors, fonts, spacing } from '../lib/theme';
import { localYmd } from '../lib/dates';
import { copy } from '../lib/copy';

export default function Home() {
  const db = useSQLiteContext();
  const router = useRouter();
  const recorder = useRecorder();
  const recording = useCaptureStore(s => s.recording);
  const lastSaved = useCaptureStore(s => s.lastSaved);

  const [students, setStudents] = useState<Student[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [voiceOn, setVoiceOn] = useState(true);
  const [apiUrl, setApiUrl] = useState('');
  const [showHint, setShowHint] = useState(false);

  const reload = useCallback(async () => {
    setStudents(await listActiveStudents(db));
    setNotes(await getNotesForLocalDate(db, localYmd()));
    setVoiceOn((await getSetting(db, 'voice_on')) !== '0');
    setApiUrl((await getSetting(db, 'api_base_url')) || DEFAULT_API_BASE_URL);
    setShowHint((await getSetting(db, 'gesture_hint_dismissed')) !== '1');
  }, [db]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  async function toggleVoice(next: boolean) {
    setVoiceOn(next);
    await setSetting(db, 'voice_on', next ? '1' : '0');
  }

  async function handleTapTile(s: Student) {
    if (recording !== null) return;
    if (!voiceOn || s.recording_enabled === 0) {
      router.push(`/note/${s.id}`);
      return;
    }
    const granted = await ensurePermission();
    if (!granted) {
      Alert.alert(copy.micDeniedSnack);
      return;
    }
    const started = useCaptureStore.getState().start(s.id, recorder);
    if (!started) return;
    try {
      await startRecording(recorder);
    } catch (e) {
      await discardRecording(recorder);
      useCaptureStore.getState().cancel();
    }
  }

  async function handleLongPressTile(s: Student) {
    router.push(`/note/${s.id}`);
    if (showHint) {
      await setSetting(db, 'gesture_hint_dismissed', '1');
      setShowHint(false);
    }
  }

  async function handleStop() {
    const r = useCaptureStore.getState().stop();
    if (!r) return;
    const audio = await stopRecording(r.recorder);
    if (!audio) return;

    const student = students.find(x => x.id === r.studentId);
    const studentName = student?.name ?? '';

    const result = await fetchTranscript(apiUrl, audio.uri);
    if (result.ok) {
      const text = result.text.trim();
      if (text === '') {
        const { id: noteId } = await addNote(db, { studentId: r.studentId, text: copy.emptyRecording, language: result.language, audioUri: null });
        await deleteRecording(audio.uri);
        useCaptureStore.getState().markSaved({ noteId, studentId: r.studentId, studentName });
      } else {
        const { id: noteId } = await addNote(db, { studentId: r.studentId, text, language: result.language, audioUri: null });
        await deleteRecording(audio.uri);
        useCaptureStore.getState().markSaved({ noteId, studentId: r.studentId, studentName });
      }
    } else {
      const { id: noteId } = await addNote(db, { studentId: r.studentId, text: copy.transcribeError, language: null, audioUri: audio.uri });
      useCaptureStore.getState().markSaved({ noteId, studentId: r.studentId, studentName });
    }
    await reload();
  }

  async function handleCancel() {
    const r = useCaptureStore.getState().cancel();
    if (!r) return;
    await discardRecording(r.recorder);
  }

  async function handleUndo() {
    const s = lastSaved;
    if (!s) return;
    useCaptureStore.getState().dismissToast();
    const row = await db.getFirstAsync<{ audio_uri: string | null }>(
      'SELECT audio_uri FROM notes WHERE id = ?', s.noteId
    );
    if (row?.audio_uri) await deleteRecording(row.audio_uri);
    await deleteNote(db, s.noteId);
    await reload();
  }

  function handleEdit() {
    const s = lastSaved;
    if (!s) return;
    useCaptureStore.getState().dismissToast();
    router.push(`/note/${s.studentId}?noteId=${s.noteId}`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={styles.topBar}>
          <Text style={styles.title}>{copy.appTitle}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <StatusPill ok={true} />
            <Link href="/settings" asChild>
              <Pressable accessibilityRole="button" accessibilityLabel={copy.settings}>
                <Feather name="settings" size={20} color={colors.ink} />
              </Pressable>
            </Link>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>{copy.voiceOff}</Text>
          <Switch value={!voiceOn} onValueChange={(v) => toggleVoice(!v)} disabled={recording !== null} />
        </View>

        <Text style={styles.sectionHead}>{copy.roster}</Text>
        {students.length === 0 ? (
          <Text style={styles.empty}>{copy.emptyRoster}</Text>
        ) : (
          <View style={styles.grid}>
            {students.map((s, i) => {
              const isRecording = recording?.studentId === s.id;
              const isOther = recording !== null && !isRecording;
              const noteCount = notes.filter(n => n.student_id === s.id).length;
              if (isRecording) {
                return <RecordingTile key={s.id} studentName={s.name} startedAt={recording!.startedAt} onStop={handleStop} onCancel={handleCancel} />;
              }
              return (
                <StudentTile
                  key={s.id}
                  name={s.name}
                  index={i}
                  notesToday={noteCount}
                  onPress={() => handleTapTile(s)}
                  onLongPress={() => handleLongPressTile(s)}
                  disabled={isOther}
                />
              );
            })}
          </View>
        )}

        {showHint && students.length > 0 && (
          <Text style={styles.gestureHint}>{copy.gestureHint}</Text>
        )}

        <Text style={styles.sectionHead}>{copy.todaysNotes}</Text>
        {notes.length === 0 ? (
          <Text style={styles.empty}>{copy.emptyNotes}</Text>
        ) : (
          notes.map((n) => (
            <NoteRow
              key={n.id}
              studentName={n.student_name}
              text={n.text}
              createdAt={n.created_at}
              onPress={() => recording === null && router.push(`/note/${n.student_id}?noteId=${n.id}`)}
            />
          ))
        )}
      </ScrollView>

      {lastSaved && (
        <ToastUndoEdit
          studentName={lastSaved.studentName}
          onUndo={handleUndo}
          onEdit={handleEdit}
          onTimeout={() => useCaptureStore.getState().dismissToast()}
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.generateSummary}
        onPress={() => recording === null && router.push('/summary')}
        disabled={recording !== null}
        style={({ pressed }) => [styles.fab, { opacity: recording !== null ? 0.5 : pressed ? 0.85 : 1 }]}
      >
        <Text style={styles.fabLabel}>{copy.generateSummary}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs, marginBottom: spacing.sm },
  rowLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted },
  sectionHead: { fontFamily: fonts.heading, fontSize: 14, color: colors.ink, marginTop: spacing.md, marginBottom: spacing.sm },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  gestureHint: { fontFamily: fonts.body, fontSize: 11, color: colors.inkMuted, fontStyle: 'italic', marginTop: spacing.xs, marginBottom: spacing.sm },
  fab: { position: 'absolute', bottom: spacing.lg, right: spacing.lg, backgroundColor: colors.accent, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: 999 },
  fabLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.accentText },
});
