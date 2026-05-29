import { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, spacing, radii } from '../lib/theme';
import { copy } from '../lib/copy';

interface Props {
  studentName: string;
  onUndo: () => void;
  onEdit: () => void;
  onTimeout: () => void;
  durationMs?: number;
}

export function ToastUndoEdit({ studentName, onUndo, onEdit, onTimeout, durationMs = 5000 }: Props) {
  const fired = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      if (fired.current) return;
      fired.current = true;
      onTimeout();
    }, durationMs);
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [durationMs, onTimeout]);

  function handle(action: () => void) {
    if (fired.current) return;
    fired.current = true;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    action();
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        <Text style={styles.msg}>{copy.savedFor(studentName)}</Text>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={copy.undo} onPress={() => handle(onUndo)}>
            <Text style={styles.undo}>{copy.undo}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={copy.edit} onPress={() => handle(onEdit)}>
            <Text style={styles.edit}>{copy.edit}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 80, alignItems: 'center', paddingHorizontal: spacing.lg },
  bar: { backgroundColor: colors.ink, borderRadius: radii.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  msg: { fontFamily: fonts.body, fontSize: 13, color: colors.accentText },
  actions: { flexDirection: 'row', gap: spacing.lg },
  undo: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accentSoft, padding: spacing.xs },
  edit: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accent2, padding: spacing.xs },
});
