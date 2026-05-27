import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, radii, spacing, fonts, shadows } from '../lib/theme';

const DOT_COLORS = ['#C4543B', '#7B9A66', '#E6A547', '#6B8FAD', '#9A6B96', '#C4543B', '#7B9A66', '#E6A547'];

interface Props {
  name: string;
  index: number;
  onPress: () => void;
}

export function StudentTile({ name, index, onPress }: Props) {
  const dotColor = DOT_COLORS[index % DOT_COLORS.length];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Log a note for ${name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, shadows.soft, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.label} numberOfLines={1}>{name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '48%',
    flexGrow: 0,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontFamily: fonts.heading, fontSize: 16, color: colors.ink, flexShrink: 1 },
});
