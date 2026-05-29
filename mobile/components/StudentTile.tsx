import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, radii, spacing, fonts, shadows } from '../lib/theme';
import { copy } from '../lib/copy';

const DOT_COLORS = ['#C4543B', '#7B9A66', '#E6A547', '#6B8FAD', '#9A6B96', '#C4543B', '#7B9A66', '#E6A547'];

interface Props {
  name: string;
  index: number;
  onPress: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  notesToday?: number;
}

export function StudentTile({ name, index, onPress, onLongPress, disabled, notesToday }: Props) {
  const dotColor = DOT_COLORS[index % DOT_COLORS.length];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Optag eller skriv en note for ${name}`}
      onPress={disabled ? undefined : onPress}
      onLongPress={disabled ? undefined : onLongPress}
      delayLongPress={500}
      disabled={disabled}
      style={({ pressed }) => [
        styles.tile,
        shadows.soft,
        pressed && !disabled && { opacity: 0.85 },
        disabled && { opacity: 0.35 },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.label} numberOfLines={1}>{name}</Text>
        {typeof notesToday === 'number' && (
          <Text style={styles.meta} numberOfLines={1}>
            {copy.notesToday(notesToday)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '48%', flexGrow: 0, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontFamily: fonts.heading, fontSize: 16, color: colors.ink, flexShrink: 1 },
  meta: { fontFamily: fonts.body, fontSize: 11, color: colors.inkMuted, marginTop: 2 },
});
