import { AbsoluteFill } from 'remotion';
import { FONTS } from './fonts';

// Platforms overlay their own chrome (caption, action rail, username) on top of
// the video. Captions/CTAs must stay inside the safe area or they get covered.
// Insets are px at the 1080×1920 composition. Approximate but conservative —
// based on where TikTok/Reels/Shorts UI actually sits as of 2026.
export type SafeZone = 'none' | 'tiktok' | 'reels' | 'shorts';

export const SAFE_ZONES: Record<SafeZone, { top: number; bottom: number; left: number; right: number }> = {
  none: { top: 0, bottom: 0, left: 0, right: 0 },
  tiktok: { top: 120, bottom: 520, left: 32, right: 220 },
  reels: { top: 150, bottom: 440, left: 32, right: 180 },
  shorts: { top: 110, bottom: 380, left: 32, right: 150 },
};

export const SAFE_ZONE_IDS = Object.keys(SAFE_ZONES) as SafeZone[];
export const DEFAULT_SAFE_ZONE: SafeZone = 'none';

const W = 1080;
const H = 1920;
// Vertical band reserved for the caption, just above the bottom safe inset.
const CAPTION_BAND = 280;
// The phone's intrinsic total height at scale 1 (screenHeight + bezel*2, ~1336);
// kept here so the layout can scale it to fit the usable stage.
const PHONE_NATURAL_HEIGHT = 1336;

export type StageLayout = {
  phoneScale: number; // multiply the phone's screenHeight to fit
  phoneTranslateY: number; // px offset from the composition's vertical centre
  captionBottom: number; // px from the bottom edge
  captionMaxWidth: number; // px, respecting left/right insets
};

// Fit the phone + caption inside the usable area for the chosen safe zone.
// 'none' keeps the original framing (phone centred, caption low) so existing
// reels are visually unchanged.
export function stageLayout(zone: SafeZone): StageLayout {
  const s = SAFE_ZONES[zone];
  if (zone === 'none') {
    return { phoneScale: 1, phoneTranslateY: -46, captionBottom: 104, captionMaxWidth: Math.round(W * 0.84) };
  }
  const usableTop = s.top;
  const usableBottom = H - s.bottom;
  const captionBottom = s.bottom + 28;
  // Phone gets the room above the caption band.
  const phoneAreaTop = usableTop;
  const phoneAreaBottom = usableBottom - CAPTION_BAND;
  const phoneAreaHeight = Math.max(200, phoneAreaBottom - phoneAreaTop);
  const phoneScale = Math.min(1, phoneAreaHeight / PHONE_NATURAL_HEIGHT);
  const phoneCenterY = phoneAreaTop + phoneAreaHeight / 2;
  return {
    phoneScale,
    phoneTranslateY: Math.round(phoneCenterY - H / 2),
    captionBottom,
    captionMaxWidth: Math.round(W - s.left - s.right),
  };
}

// Vertical shift (px from composition centre) that moves full-screen card
// content into the usable area for the chosen safe zone.
export function usableCenterOffset(zone: SafeZone): number {
  const s = SAFE_ZONES[zone];
  return Math.round((s.top - s.bottom) / 2);
}

const OVERLAY_BLOCK: React.CSSProperties = {
  position: 'absolute',
  background: 'rgba(255,70,120,0.16)',
  borderColor: 'rgba(255,70,120,0.5)',
  borderStyle: 'dashed',
  borderWidth: 2,
};

// Dev-only translucent guides showing where platform chrome sits. Off by default;
// flip the `showSafeZones` prop in Remotion Studio while composing.
export const SafeZoneOverlay: React.FC<{ zone: SafeZone }> = ({ zone }) => {
  if (zone === 'none') return null;
  const s = SAFE_ZONES[zone];
  return (
    <AbsoluteFill style={{ zIndex: 50, pointerEvents: 'none' }}>
      <div style={{ ...OVERLAY_BLOCK, top: 0, left: 0, right: 0, height: s.top }} />
      <div style={{ ...OVERLAY_BLOCK, bottom: 0, left: 0, right: 0, height: s.bottom }} />
      <div style={{ ...OVERLAY_BLOCK, top: s.top, bottom: s.bottom, left: 0, width: s.left }} />
      <div style={{ ...OVERLAY_BLOCK, top: s.top, bottom: s.bottom, right: 0, width: s.right }} />
      <div style={{ position: 'absolute', top: s.top + 12, left: '50%', transform: 'translateX(-50%)', color: '#ff5a78', fontFamily: FONTS.body, fontWeight: 700, fontSize: 26, letterSpacing: 2 }}>
        {zone.toUpperCase()} SAFE AREA
      </div>
    </AbsoluteFill>
  );
};
