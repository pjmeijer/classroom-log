import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, spacing, radii } from '../lib/theme';
import { copy } from '../lib/copy';

interface Props {
  startedAt: number;
  onStop: () => void;
  onCancel: () => void;
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

export function RecordingBar({ startedAt, onStop, onCancel }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.bar}>
      <Text style={styles.label}>{copy.recording} {formatElapsed(now - startedAt)}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.stopAndSave} onPress={onStop} style={styles.stop}>
          <Text style={styles.stopLabel}>{copy.stopAndSave}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.cancel} onPress={onCancel} style={styles.cancel}>
          <Text style={styles.cancelLabel}>{copy.cancel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.accent, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accentText, fontVariant: ['tabular-nums'] },
  stop: { backgroundColor: colors.accentText, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.sm },
  stopLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent },
  cancel: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.accentText },
  cancelLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accentText },
});
