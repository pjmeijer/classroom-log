import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, Keyboard, Platform, type KeyboardEvent } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addNote, updateNote, deleteNote, getNote, listActiveStudents, getSetting, Student } from '../../db/db';
import { DiscardSheet } from '../../components/DiscardSheet';
import { RecordingBar } from '../../components/RecordingBar';
import { useCaptureStore } from '../../store/useCaptureStore';
import { ensurePermission, useRecorder, startRecording, stopRecording, deleteRecording, discardRecording } from '../../lib/audio';
import { fetchTranscript } from '../../api/transcribe';
import { DEFAULT_API_BASE_URL } from '../../api/config';
import { colors, fonts, spacing, radii, shadows } from '../../lib/theme';
import { copy } from '../../lib/copy';

const MAX_LEN = 5000;

export default function NoteModal() {
  const db = useSQLiteContext();
  const router = useRouter();
  const navigation = useNavigation();
  const recorder = useRecorder();
  const { studentId, noteId } = useLocalSearchParams<{ studentId: string; noteId?: string }>();
  const [student, setStudent] = useState<Student | null>(null);
  const [apiUrl, setApiUrl] = useState('');
  const [text, setText] = useState('');
  const [initialText, setInitialText] = useState('');
  const [discardVisible, setDiscardVisible] = useState(false);
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const pendingActionRef = useRef<unknown>(null);
  const recording = useCaptureStore(s => s.recording);
  const recordingInThisModal = recording?.studentId === studentId;
  // Manual keyboard-height tracking. React Native's KeyboardAvoidingView
  // does not compute the correct offset inside expo-router's
  // `presentation: 'modal'` (iOS sheet) — keyboard frames are
  // screen-relative but KAV measures from inside the modal, so
  // behavior="padding" leaves the save button hidden. Tracking the
  // height ourselves and applying it as paddingBottom on a wrapper
  // around the modal content keeps the save button above the keyboard.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const onShow = (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      onShow,
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      onHide,
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    (async () => {
      const all = await listActiveStudents(db);
      const s = all.find(x => x.id === studentId);
      setStudent(s || null);
      setApiUrl((await getSetting(db, 'api_base_url')) || DEFAULT_API_BASE_URL);
      if (noteId) {
        const n = await getNote(db, noteId);
        if (n) {
          setText(n.text);
          setInitialText(n.text);
          setAudioUri(n.audio_uri ?? null);
          setSelection({ start: n.text.length, end: n.text.length });
        }
      }
    })();
  }, [studentId, noteId, db]);

  const dirty = text !== initialText;
  const editing = !!noteId;
  const allowLeaveRef = useRef(false);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !(dirty || recordingInThisModal) });
  }, [navigation, dirty, recordingInThisModal]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', async (e: any) => {
      if (recording !== null && recordingInThisModal) {
        e.preventDefault();
        const r = useCaptureStore.getState().cancel();
        if (r) await discardRecording(r.recorder);
        // Codex P1: re-dispatching here used to bypass the dirty-text guard.
        // If typed-but-unsaved text exists, queue the dismissal and surface
        // DiscardSheet first; the user re-confirms via discard/save.
        if (dirty && !allowLeaveRef.current) {
          pendingActionRef.current = e.data.action;
          setDiscardVisible(true);
          return;
        }
        navigation.dispatch(e.data.action);
        return;
      }
      if (!dirty || allowLeaveRef.current) return;
      e.preventDefault();
      pendingActionRef.current = e.data.action;
      setDiscardVisible(true);
    });
    return unsubscribe;
  }, [navigation, dirty, recording, recordingInThisModal]);

  function dispatchPending() {
    allowLeaveRef.current = true;
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action) navigation.dispatch(action as any);
    else router.back();
  }

  function handleClose() {
    if (recording !== null && recordingInThisModal) {
      router.back();
      return;
    }
    if (dirty) setDiscardVisible(true);
    else {
      allowLeaveRef.current = true;
      router.back();
    }
  }

  async function handleSave() {
    if (!text.trim()) return;
    if (noteId) await updateNote(db, noteId, text);
    else if (student) await addNote(db, { studentId: student.id, text });
    dispatchPending();
  }

  function handleDiscard() {
    setDiscardVisible(false);
    dispatchPending();
  }

  async function handleDelete() {
    Alert.alert(copy.deleteConfirmTitle, copy.deleteConfirmBody, [
      { text: copy.cancel, style: 'cancel' },
      { text: copy.delete, style: 'destructive', onPress: async () => {
        if (noteId) {
          await deleteNote(db, noteId);
          allowLeaveRef.current = true;
          router.back();
        }
      } },
    ]);
  }

  async function handleMicTap() {
    if (recording !== null) return;
    // The global "Stemme fra" setting governs the home-screen tile
    // single-tap so users don't start a recording by accident. It does
    // NOT gate this modal's mic chip — by the time a user has long-
    // pressed a tile and tapped the chip, they've taken intentional
    // action. The per-student recording_enabled gate still applies
    // because that's a privacy/consent opt-out, not a UX safety toggle.
    if (student?.recording_enabled === 0) return;
    const granted = await ensurePermission();
    if (!granted) {
      Alert.alert(copy.micDeniedSnack);
      return;
    }
    const started = useCaptureStore.getState().start(studentId, recorder);
    if (!started) return;
    try {
      await startRecording(recorder);
    } catch {
      await discardRecording(recorder);
      useCaptureStore.getState().cancel();
      Alert.alert(copy.recordStartFailed);
    }
  }

  async function handleStopAndAppend() {
    const r = useCaptureStore.getState().stop();
    if (!r) return;
    const audio = await stopRecording(r.recorder);
    if (!audio) return;
    const result = await fetchTranscript(apiUrl, audio.uri);
    await deleteRecording(audio.uri);
    if (!result.ok) {
      Alert.alert(copy.summaryUpstreamError);
      return;
    }
    const transcript = result.text.trim();
    if (!transcript) return;
    setText(prev => (prev.slice(0, selection.start) + transcript + prev.slice(selection.end)).slice(0, MAX_LEN));
    const newPos = Math.min(selection.start + transcript.length, MAX_LEN);
    setSelection({ start: newPos, end: newPos });
  }

  async function handleBarCancel() {
    const r = useCaptureStore.getState().cancel();
    if (!r) return;
    await discardRecording(r.recorder);
  }

  async function handleRetryTranscription() {
    if (!audioUri || !noteId || retrying || recording !== null) return;
    setRetrying(true);
    try {
      const result = await fetchTranscript(apiUrl, audioUri);
      if (!result.ok) {
        Alert.alert(copy.transcribeError);
        return;
      }
      const transcript = result.text.trim() || copy.emptyRecording;
      await updateNote(db, noteId, transcript, { language: result.language, clearAudioUri: true });
      await deleteRecording(audioUri);
      setText(transcript);
      setInitialText(transcript);
      setAudioUri(null);
      setSelection({ start: transcript.length, end: transcript.length });
    } finally {
      setRetrying(false);
    }
  }

  // micAllowed mirrors handleMicTap's gate — see there for the
  // rationale on why "Stemme fra" is not checked.
  const micAllowed = student?.recording_enabled === 1 && recording === null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, paddingBottom: keyboardHeight }}>
        <View style={styles.header}>
          <Text style={styles.title}>{student?.name ?? copy.noteHeaderNote}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.recording}
              disabled={!micAllowed}
              onPress={handleMicTap}
              style={[styles.micToggle, { backgroundColor: micAllowed ? colors.accentSoft : colors.surface2, opacity: micAllowed ? 1 : 0.5 }]}
            >
              <Feather name="mic" size={20} color={micAllowed ? colors.accent : colors.inkMuted} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={copy.cancel} onPress={handleClose}>
              <Feather name="x" size={22} color={colors.inkMuted} />
            </Pressable>
          </View>
        </View>

        <TextInput
          autoFocus
          multiline
          value={text}
          onChangeText={(t) => setText(t.slice(0, MAX_LEN))}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          selection={selection}
          placeholder={copy.noteTextarea}
          placeholderTextColor={colors.inkMuted}
          style={styles.textarea}
        />

        {recordingInThisModal && (
          <RecordingBar startedAt={recording!.startedAt} onStop={handleStopAndAppend} onCancel={handleBarCancel} />
        )}

        {editing && audioUri && recording === null && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.retryTranscription}
            onPress={handleRetryTranscription}
            disabled={retrying}
            style={[styles.retryBtn, retrying && { opacity: 0.5 }]}
          >
            <Text style={styles.retryLabel}>{copy.retryTranscription}</Text>
          </Pressable>
        )}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={handleSave}
            disabled={!text.trim()}
            style={[styles.saveBtn, !text.trim() && { opacity: 0.5 }, shadows.soft]}
          >
            <Text style={styles.saveLabel}>{editing ? copy.update : copy.save}</Text>
          </Pressable>
        </View>

        {editing && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.holdToDelete}
            onLongPress={handleDelete}
            delayLongPress={800}
            style={styles.deleteBtn}
          >
            <Text style={styles.deleteLabel}>{copy.holdToDelete}</Text>
          </Pressable>
        )}

        <DiscardSheet
          visible={discardVisible}
          onSave={async () => { setDiscardVisible(false); await handleSave(); }}
          onDiscard={handleDiscard}
          onKeepEditing={() => setDiscardVisible(false)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  micToggle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  textarea: { flex: 1, padding: spacing.lg, fontFamily: fonts.body, fontSize: 16, color: colors.ink, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, alignItems: 'center' },
  saveBtn: { flex: 1, backgroundColor: colors.accent2, paddingVertical: spacing.md, borderRadius: radii.md, alignItems: 'center' },
  saveLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.accentText },
  deleteBtn: { alignSelf: 'center', padding: spacing.md, marginBottom: spacing.lg },
  deleteLabel: { fontFamily: fonts.headingItalic, fontSize: 13, color: colors.danger },
  retryBtn: { alignSelf: 'center', backgroundColor: colors.surface2, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.md, marginVertical: spacing.sm },
  retryLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
});
