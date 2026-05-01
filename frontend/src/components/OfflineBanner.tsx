import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export function OfflineBanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isOnline = useNetworkStatus();

  if (isOnline !== false) return null;

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: colors.warning, paddingTop: insets.top + 6 },
      ]}
    >
      <Ionicons name="cloud-offline-outline" size={14} color="#FFF" />
      <Text style={styles.text}>Offline — showing cached data</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingBottom: 6,
    gap: 6,
  },
  text: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    color: '#FFF',
    letterSpacing: 0.3,
  },
});
