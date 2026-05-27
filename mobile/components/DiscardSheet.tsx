import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { PrimaryButton } from './PrimaryButton';
import { colors, fonts, spacing, radii } from '../lib/theme';

interface Props {
  visible: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onKeepEditing: () => void;
}

export function DiscardSheet({ visible, onSave, onDiscard, onKeepEditing }: Props) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onKeepEditing}>
      <Pressable style={styles.backdrop} onPress={onKeepEditing} />
      <View style={styles.sheet}>
        <Text style={styles.heading}>You have unsaved changes</Text>
        <Text style={styles.body}>Save this note, discard it, or keep editing?</Text>
        <View style={styles.actions}>
          <PrimaryButton label="Save" onPress={onSave} variant="primary" />
          <View style={{ height: spacing.sm }} />
          <PrimaryButton label="Discard" onPress={onDiscard} variant="ghost" />
          <View style={{ height: spacing.sm }} />
          <PrimaryButton label="Keep editing" onPress={onKeepEditing} variant="secondary" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', inset: 0 as any, backgroundColor: 'rgba(42, 38, 32, .4)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.bg, padding: spacing.xl, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg },
  heading: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink, marginBottom: spacing.xs },
  body: { fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted, marginBottom: spacing.lg },
  actions: { gap: 0 },
});
