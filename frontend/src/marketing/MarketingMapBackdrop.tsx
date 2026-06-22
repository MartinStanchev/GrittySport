import { useMemo } from 'react';
import { Image, Platform, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';

interface LatLng {
  lat: number;
  lng: number;
}

interface MarketingMapBackdropProps {
  points?: LatLng[];
  width?: number;
  height: number;
  style?: StyleProp<ViewStyle>;
}

const TILE = 256;
const MAX_ZOOM = 16;
const PAD = 40;

// react-native-maps is native-only (it renders a gray "not available" box on web,
// where marketing captures run). This draws a *real* slippy map for web by tiling
// CARTO raster basemaps (dark/light to match the theme) under the recorded route,
// using the same Web Mercator projection so the polyline lands on the streets.
// On native it falls back to a themed surface (the real screens use MapView there).
export function MarketingMapBackdrop({ points = [], width = 393, height, style }: MarketingMapBackdropProps) {
  const { colors, isDark } = useTheme();
  const surface = isDark ? '#11131a' : '#e9eef5';

  const layout = useMemo(() => buildLayout(points, width, height), [points, width, height]);

  // Native build: keep the lightweight stand-in (captures run on web only).
  if (Platform.OS !== 'web' || !layout) {
    return <View style={[{ width, height, backgroundColor: surface }, style]} />;
  }

  const tileStyle = isDark ? 'dark_all' : 'light_all';
  const labelColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const start = layout.coords[0];
  const end = layout.coords[layout.coords.length - 1];

  return (
    <View style={[{ width, height, overflow: 'hidden', backgroundColor: surface }, style]}>
      {layout.tiles.map((t) => (
        <Image
          key={`${t.z}-${t.x}-${t.y}`}
          source={{ uri: `https://a.basemaps.cartocdn.com/${tileStyle}/${t.z}/${t.x}/${t.y}@2x.png` }}
          style={{ position: 'absolute', left: t.left, top: t.top, width: TILE, height: TILE }}
        />
      ))}
      <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Polyline
          points={layout.coords.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={colors.secondary}
          strokeWidth={6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Circle cx={start.x} cy={start.y} r={8} fill={colors.primary} stroke="#fff" strokeWidth={3} />
        <Circle cx={end.x} cy={end.y} r={8} fill={colors.secondary} stroke="#fff" strokeWidth={3} />
      </Svg>
      <Text style={{ position: 'absolute', right: 6, bottom: 4, fontSize: 9, color: labelColor }}>© OpenStreetMap, © CARTO</Text>
    </View>
  );
}

// Web Mercator: lat/lng → world pixel coordinates at a given zoom.
function project(lat: number, lng: number, z: number) {
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  const world = TILE * 2 ** z;
  return {
    x: ((lng + 180) / 360) * world,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world,
  };
}

// Pick the zoom that fits the route in the viewport, then compute the tiles that
// cover it and the route's on-screen coordinates (both relative to the same
// top-left world-pixel origin so they stay aligned).
function buildLayout(points: LatLng[], width: number, height: number) {
  if (points.length < 2) return null;

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  let zoom = 1;
  for (let z = MAX_ZOOM; z >= 1; z--) {
    const a = project(maxLat, minLng, z);
    const b = project(minLat, maxLng, z);
    if (b.x - a.x <= width - PAD * 2 && b.y - a.y <= height - PAD * 2) {
      zoom = z;
      break;
    }
  }

  const center = project((minLat + maxLat) / 2, (minLng + maxLng) / 2, zoom);
  const origin = { x: center.x - width / 2, y: center.y - height / 2 };
  const span = 2 ** zoom;

  const tiles: { z: number; x: number; y: number; left: number; top: number }[] = [];
  const firstX = Math.floor(origin.x / TILE);
  const firstY = Math.floor(origin.y / TILE);
  for (let px = firstX * TILE; px < origin.x + width; px += TILE) {
    for (let py = firstY * TILE; py < origin.y + height; py += TILE) {
      const tx = Math.floor(px / TILE);
      const ty = Math.floor(py / TILE);
      if (ty < 0 || ty >= span) continue;
      tiles.push({ z: zoom, x: ((tx % span) + span) % span, y: ty, left: px - origin.x, top: py - origin.y });
    }
  }

  const coords = points.map((p) => {
    const w = project(p.lat, p.lng, zoom);
    return { x: w.x - origin.x, y: w.y - origin.y };
  });

  return { tiles, coords };
}
