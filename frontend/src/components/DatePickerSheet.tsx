import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';

interface Props {
  visible: boolean;
  value: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  minimumDate?: Date;
  maximumDate?: Date;
  title?: string;
}

export default function DatePickerSheet({
  visible,
  value,
  onConfirm,
  onCancel,
  minimumDate,
  maximumDate,
  title = 'Select date',
}: Props) {
  const { colors, isDark } = useTheme();
  const [draft, setDraft] = useState<Date>(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !visible) return;
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      minimumDate,
      maximumDate,
      onChange: (event, date) => {
        if (event.type === 'set' && date) onConfirm(date);
        else onCancel();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (Platform.OS !== 'ios') return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {}}
        >
          <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
            <Pressable onPress={onCancel} hitSlop={10}>
              <Text style={[styles.headerAction, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
            <Pressable onPress={() => onConfirm(draft)} hitSlop={10}>
              <Text style={[styles.headerAction, { color: colors.primary }]}>Done</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={draft}
            mode="date"
            display="inline"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            themeVariant={isDark ? 'dark' : 'light'}
            accentColor={colors.primary}
            onChange={(_, date) => date && setDraft(date)}
            style={styles.picker}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 15,
    fontFamily: Fonts.headingMedium,
  },
  headerAction: {
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
  },
  picker: {
    width: 340,
    height: 360,
    alignSelf: 'center',
  },
});
