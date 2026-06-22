import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, UrlTile } from './NativeMap';
import { useTheme } from '../contexts/ThemeContext';

interface RouteMapPreviewProps {
  gpsRoute: Record<string, any>;
  style?: object;
}

interface Coord {
  latitude: number;
  longitude: number;
}

function toCoords(gpsRoute: Record<string, any>): Coord[] {
  return (gpsRoute.points ?? []).map((p: any) => ({ latitude: p.lat, longitude: p.lng }));
}

function regionForCoords(coords: Coord[]) {
  const lats = coords.map((p) => p.latitude);
  const lngs = coords.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: (maxLat - minLat) * 1.4 + 0.005,
    longitudeDelta: (maxLng - minLng) * 1.4 + 0.005,
  };
}

export function RouteMapPreview({ gpsRoute, style }: RouteMapPreviewProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const fullMapRef = useRef<any>(null);

  const points = toCoords(gpsRoute);
  if (points.length < 2) return null;

  const region = regionForCoords(points);
  const start = points[0];
  const end = points[points.length - 1];

  const osmTile =
    Platform.OS === 'android' ? (
      <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} />
    ) : null;

  function fitRoute() {
    fullMapRef.current?.fitToCoordinates(points, {
      edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
      animated: false,
    });
  }

  return (
    <>
      <Pressable
        style={[styles.container, style]}
        onPress={() => setExpanded(true)}
        accessibilityRole="button"
        accessibilityLabel="Expand route map"
      >
        <MapView
          style={styles.map}
          region={region}
          scrollEnabled={false}
          zoomEnabled={false}
          mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        >
          {osmTile}
          <Polyline coordinates={points} strokeColor={colors.primary} strokeWidth={4} />
        </MapView>
        <View style={[styles.expandHint, { backgroundColor: colors.surface }]} pointerEvents="none">
          <Ionicons name="expand-outline" size={18} color={colors.textPrimary} />
        </View>
      </Pressable>

      <Modal visible={expanded} animationType="slide" onRequestClose={() => setExpanded(false)}>
        <View style={styles.fullContainer}>
          <MapView
            ref={fullMapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={region}
            scrollEnabled
            zoomEnabled
            rotateEnabled
            pitchEnabled
            showsCompass
            onMapReady={fitRoute}
            mapType={Platform.OS === 'android' ? 'none' : 'standard'}
          >
            {osmTile}
            <Polyline coordinates={points} strokeColor={colors.primary} strokeWidth={5} />
            <Marker coordinate={start} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={[styles.endpointMarker, { backgroundColor: colors.success, borderColor: colors.surface }]} />
            </Marker>
            <Marker coordinate={end} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={[styles.endpointMarker, { backgroundColor: colors.error, borderColor: colors.surface }]} />
            </Marker>
          </MapView>
          <Pressable
            style={[styles.iconBtn, { left: 16, top: insets.top + 12, backgroundColor: colors.surface }]}
            onPress={() => setExpanded(false)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close map"
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
          <Pressable
            style={[styles.iconBtn, { right: 16, bottom: insets.bottom + 20, backgroundColor: colors.surface }]}
            onPress={fitRoute}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Recenter route"
          >
            <Ionicons name="scan-outline" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    overflow: 'hidden',
    height: 180,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  expandHint: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.92,
  },
  fullContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  iconBtn: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  endpointMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
  },
});
