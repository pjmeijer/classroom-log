import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addNote, updateNote, deleteNote, getNote, listActiveStudents, getSetting, Student } from '../../db/db';
import { DiscardSheet } from '../../components/DiscardSheet';
import { colors, fonts, spacing, radii, shadows } from '../../lib/theme';

const MAX_LEN = 5000;

export default function NoteModal() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { studentId, noteId } = useLocalSearchParams<{ studentId: string; noteId?: string }>();
  const [student, setStudent] = useState<Student | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [text, setText] = useState('');
  const [initialText, setInitialText] = useState('');
  const [discardVisible, setDiscardVisible] = useState(false);

  useEffect(() => {
    (async () => {
      const all = await listActiveStudents(db);
      const s = all.find(x => x.id === studentId);
      setStudent(s || null);
      setVoiceOn((await getSetting(db, 'voice_on')) !== '0');
      if (noteId) {
        const n = await getNote(db, noteId);
        if (n) {
          setText(n.text);
          setInitialText(n.text);
        }
      }
    })();
  }, [studentId, noteId, db]);

  const dirty = text !== initialText;
  const editing = !!noteId;

  function handleClose() {
    if (dirty && text.trim()) setDiscardVisible(true);
    else router.back();
  }

  async function handleSave() {
    if (!text.trim()) return;
    if (noteId) await updateNote(db, noteId, text);
    else if (student) await addNote(db, { studentId: student.id, text });
    router.back();
  }

  function handleDiscard() {
    setDiscardVisible(false);
    router.back();
  }

  async function handleDelete() {
    Alert.alert(
      'Delete this note?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { if (noteId) { await deleteNote(db, noteId); router.back(); } } },
      ],
    );
  }

  const micAllowed = voiceOn && student?.recording_enabled === 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Text style={styles.title}>{student?.name ?? 'Note'}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={micAllowed ? 'Voice enabled' : 'Voice disabled'}
            disabled={!micAllowed}
            style={[styles.micToggle, { backgroundColor: micAllowed ? colors.accentSoft : colors.surface2, opacity: micAllowed ? 1 : 0.5 }]}
          >
            <Text style={{ fontSize: 14 }}>🎙</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={handleClose}>
            <Text style={styles.x}>✕</Text>
          </Pressable>
        </View>
      </View>

      <TextInput
        autoFocus
        multiline
        value={text}
        onChangeText={(t) => setText(t.slice(0, MAX_LEN))}
        placeholder={micAllowed ? 'Type or tap the mic to dictate…' : 'Type your note…'}
        placeholderTextColor={colors.inkMuted}
        style={styles.textarea}
      />
      {text.length >= MAX_LEN && (
        <Text style={styles.capWarn}>Note is at the {MAX_LEN.toLocaleString()}-character limit.</Text>
      )}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start recording"
          disabled={!micAllowed}
          onPress={() => Alert.alert('Coming up next', 'Voice recording is wired in Task 14.')}
          style={[styles.mic, { backgroundColor: micAllowed ? colors.accent : colors.surface2, opacity: micAllowed ? 1 : 0.5 }]}
        >
          <Text style={styles.micIcon}>🎙</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={handleSave}
          disabled={!text.trim()}
          style={[styles.saveBtn, !text.trim() && { opacity: 0.5 }, shadows.soft]}
        >
          <Text style={styles.saveLabel}>{editing ? 'Update' : 'Save'}</Text>
        </Pressable>
      </View>

      {editing && (
        <Pressable onLongPress={handleDelete} delayLongPress={800} style={styles.deleteBtn}>
          <Text style={styles.deleteLabel}>Hold to delete</Text>
        </Pressable>
      )}

      <DiscardSheet
        visible={discardVisible}
        onSave={async () => { setDiscardVisible(false); await handleSave(); }}
        onDiscard={handleDiscard}
        onKeepEditing={() => setDiscardVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  micToggle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  x: { fontSize: 22, color: colors.inkMuted },
  textarea: { flex: 1, padding: spacing.lg, fontFamily: fonts.body, fontSize: 16, color: colors.ink, textAlignVertical: 'top' },
  capWarn: { fontFamily: fonts.body, fontSize: 12, color: colors.danger, textAlign: 'center', paddingBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, alignItems: 'center' },
  mic: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  micIcon: { fontSize: 24, color: colors.accentText },
  saveBtn: { flex: 1, backgroundColor: colors.accent2, paddingVertical: spacing.md, borderRadius: radii.md, alignItems: 'center' },
  saveLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.accentText },
  deleteBtn: { alignSelf: 'center', padding: spacing.md, marginBottom: spacing.lg },
  deleteLabel: { fontFamily: fonts.headingItalic, fontSize: 13, color: colors.danger },
});
