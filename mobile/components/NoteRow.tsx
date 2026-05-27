import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, radii, spacing, fonts, shadows } from '../lib/theme';
import { formatTime } from '../lib/dates';

interface Props {
  studentName: string;
  text: string;
  createdAt: number;
  onPress: () => void;
}

export function NoteRow({ studentName, text, createdAt, onPress }: Props) {
  const preview = text.length > 80 ? text.slice(0, 80).trim() + '…' : text;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, shadows.soft, pressed && { opacity: 0.85 }]}>
      <View style={styles.meta}>
        <Text style={styles.time}>{formatTime(createdAt)}</Text>
        <Text style={styles.name}>{studentName}</Text>
      </View>
      <Text style={styles.body}>{preview}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  time: { fontFamily: fonts.headingItalic, fontSize: 12, color: colors.inkMuted },
  name: { fontFamily: fonts.headingItalic, fontSize: 12, color: colors.inkMuted },
  body: { fontFamily: fonts.body, fontSize: 13, color: colors.ink, lineHeight: 18 },
});
