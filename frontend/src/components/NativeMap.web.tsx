// Web: stub components — react-native-maps is native-only
import { View, Text, StyleSheet } from 'react-native';

export default function MapView({ style, children }: any) {
  return (
    <View style={[styles.placeholder, style]}>
      <Text style={styles.label}>Map not available on web</Text>
      {children}
    </View>
  );
}

export function Polyline(_props: any) {
  return null;
}

export function UrlTile(_props: any) {
  return null;
}

export function Marker(_props: any) {
  return null;
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    color: '#888',
    fontSize: 13,
  },
});
