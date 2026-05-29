import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { colors, fonts, spacing, radii, shadows } from '../lib/theme';
import { copy } from '../lib/copy';

interface Props {
  studentName: string;
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

export function RecordingTile({ studentName, startedAt, onStop, onCancel }: Props) {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={[styles.tile, shadows.soft]}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Animated.View style={[styles.dot, { opacity: pulse }]} />
          <Text style={styles.headerLabel}>{copy.recording}</Text>
        </View>
        <Text style={styles.timer}>{formatElapsed(now - startedAt)}</Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>{studentName}</Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.stopAndSave}
          onPress={onStop}
          style={({ pressed }) => [styles.stop, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.stopLabel}>{copy.stopAndSave}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.cancel}
          onPress={onCancel}
          style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.cancelLabel}>{copy.cancel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '100%',
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentText },
  headerLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.accentText, opacity: 0.85 },
  timer: { fontFamily: fonts.body, fontSize: 13, color: colors.accentText, fontVariant: ['tabular-nums'] },
  name: { fontFamily: fonts.heading, fontSize: 17, color: colors.accentText, marginVertical: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  stop: { flex: 1, backgroundColor: colors.accentText, paddingVertical: spacing.md, borderRadius: radii.sm, alignItems: 'center' },
  stopLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.accent },
  cancel: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.accentText, alignItems: 'center', justifyContent: 'center' },
  cancelLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accentText },
});
