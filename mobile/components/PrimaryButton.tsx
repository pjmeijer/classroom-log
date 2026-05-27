import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, fonts, shadows } from '../lib/theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}

export function PrimaryButton({ label, onPress, variant = 'primary', disabled }: Props) {
  const bg = variant === 'primary' ? colors.accent : variant === 'secondary' ? colors.accent2 : 'transparent';
  const fg = variant === 'ghost' ? colors.ink : colors.accentText;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.border },
        variant !== 'ghost' && shadows.soft,
      ]}
    >
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: fonts.bodyBold, fontSize: 15 },
});
