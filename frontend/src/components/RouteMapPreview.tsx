import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Polyline, UrlTile } from './NativeMap';
import { useTheme } from '../contexts/ThemeContext';

interface RouteMapPreviewProps {
  gpsRoute: Record<string, any>;
  style?: object;
}

export function RouteMapPreview({ gpsRoute, style }: RouteMapPreviewProps) {
  const { colors } = useTheme();
  const points: { latitude: number; longitude: number }[] = (gpsRoute.points ?? []).map(
    (p: any) => ({ latitude: p.lat, longitude: p.lng }),
  );

  if (points.length < 2) return null;

  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const region = {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: (maxLat - minLat) * 1.4 + 0.005,
    longitudeDelta: (maxLng - minLng) * 1.4 + 0.005,
  };

  return (
    <View style={[styles.container, style]}>
      <MapView
        style={styles.map}
        region={region}
        scrollEnabled={false}
        zoomEnabled={false}
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
      >
        {Platform.OS === 'android' && (
          <UrlTile
            urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maximumZ={19}
            flipY={false}
          />
        )}
        <Polyline coordinates={points} strokeColor={colors.primary} strokeWidth={4} />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: 180,
  },
});
