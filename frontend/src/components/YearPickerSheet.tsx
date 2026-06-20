import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';

const ITEM_HEIGHT = 44;
const VISIBLE_COUNT = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT;
const VERTICAL_PADDING = ((VISIBLE_COUNT - 1) / 2) * ITEM_HEIGHT;

interface Props {
  visible: boolean;
  value: number | null;
  minYear: number;
  maxYear: number;
  onConfirm: (year: number) => void;
  onCancel: () => void;
  title?: string;
}

export default function YearPickerSheet({
  visible,
  value,
  minYear,
  maxYear,
  onConfirm,
  onCancel,
  title = 'Year of birth',
}: Props) {
  const { colors } = useTheme();

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = maxYear; y >= minYear; y--) arr.push(y);
    return arr;
  }, [minYear, maxYear]);

  const initialIndex = useMemo(() => {
    if (value != null && value >= minYear && value <= maxYear) return maxYear - value;
    return 0;
  }, [value, minYear, maxYear]);

  const [draftIndex, setDraftIndex] = useState(initialIndex);
  const listRef = useRef<FlatList<number>>(null);

  useEffect(() => {
    if (visible) {
      setDraftIndex(initialIndex);
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      });
    }
  }, [visible, initialIndex]);

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    setDraftIndex(Math.max(0, Math.min(years.length - 1, i)));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
          onPress={onCancel}
        />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
            <Pressable onPress={onCancel} hitSlop={10}>
              <Text style={[styles.headerAction, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
            <Pressable onPress={() => onConfirm(years[draftIndex])} hitSlop={10}>
              <Text style={[styles.headerAction, { color: colors.primary }]}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.pickerWrap}>
            <View
              pointerEvents="none"
              style={[
                styles.selectionBand,
                { borderColor: colors.border, backgroundColor: colors.inputBackground },
              ]}
            />
            <FlatList
              ref={listRef}
              data={years}
              keyExtractor={(y) => String(y)}
              showsVerticalScrollIndicator={false}
              snapToInterval={ITEM_HEIGHT}
              decelerationRate="fast"
              getItemLayout={(_, i) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * i, index: i })}
              initialScrollIndex={initialIndex}
              contentContainerStyle={{ paddingVertical: VERTICAL_PADDING }}
              onMomentumScrollEnd={handleScrollEnd}
              onScrollEndDrag={handleScrollEnd}
              style={{ height: PICKER_HEIGHT }}
              renderItem={({ item, index }) => {
                const distance = Math.abs(index - draftIndex);
                const opacity = distance === 0 ? 1 : distance === 1 ? 0.55 : 0.3;
                return (
                  <View style={styles.item}>
                    <Text
                      style={[
                        styles.itemText,
                        { color: colors.textPrimary, opacity },
                        distance === 0 && { fontFamily: Fonts.heading },
                      ]}
                    >
                      {item}
                    </Text>
                  </View>
                );
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
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
  title: { fontSize: 15, fontFamily: Fonts.headingMedium },
  headerAction: { fontSize: 15, fontFamily: Fonts.bodySemiBold },
  pickerWrap: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    position: 'relative',
  },
  selectionBand: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 12 + (PICKER_HEIGHT - ITEM_HEIGHT) / 2,
    height: ITEM_HEIGHT,
    borderRadius: 12,
    borderWidth: 1,
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 22,
    fontFamily: Fonts.bodyMedium,
  },
});
