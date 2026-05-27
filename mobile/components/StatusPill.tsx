import { Text, View, StyleSheet } from 'react-native';
import { colors, fonts } from '../lib/theme';

interface Props {
  ok: boolean;
}

export function StatusPill({ ok }: Props) {
  return (
    <View style={[styles.pill, { backgroundColor: ok ? colors.accentSoft : '#EEE2DD' }]}>
      <View style={[styles.dot, { backgroundColor: ok ? colors.accent2 : colors.inkMuted }]} />
      <Text style={[styles.label, { color: ok ? colors.accent : colors.inkMuted }]}>{ok ? 'AI: connected' : 'AI: offline'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontFamily: fonts.body, fontSize: 11 },
});
