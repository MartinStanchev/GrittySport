import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { background } from '../theme';
import { textColor, accentFor } from '../brandKit';
import { FONTS } from '../fonts';
import { usableCenterOffset, type SafeZone } from '../safeZones';
import type { CtaBeatData } from './types';

const AppleBadge: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#000', borderRadius: 18, padding: '18px 30px', minWidth: 300 }}>
    <svg width="44" height="44" viewBox="0 0 24 24" fill="#fff" aria-hidden>
      <path d="M16.36 12.78c.02 2.5 2.19 3.33 2.22 3.34-.02.06-.35 1.18-1.14 2.34-.69 1-1.4 2-2.52 2.02-1.1.02-1.45-.65-2.71-.65-1.26 0-1.65.63-2.69.67-1.08.04-1.9-1.08-2.59-2.08-1.42-2.05-2.5-5.79-1.05-8.32.72-1.25 2.01-2.05 3.41-2.07 1.06-.02 2.06.71 2.71.71.65 0 1.87-.88 3.15-.75.54.02 2.05.22 3.02 1.64-.08.05-1.8 1.05-1.78 3.13M14.3 4.6c.57-.69.96-1.65.85-2.6-.83.03-1.83.55-2.42 1.24-.53.61-.99 1.59-.87 2.52.92.07 1.87-.47 2.44-1.16"/>
    </svg>
    <div style={{ textAlign: 'left', fontFamily: FONTS.body, color: '#fff' }}>
      <div style={{ fontSize: 20, opacity: 0.85 }}>Download on the</div>
      <div style={{ fontSize: 38, fontWeight: 600, lineHeight: 1.05 }}>App Store</div>
    </div>
  </div>
);

const GooglePlayBadge: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#000', borderRadius: 18, padding: '18px 30px', minWidth: 300 }}>
    <svg width="40" height="44" viewBox="0 0 512 512" aria-hidden>
      <path fill="#00d3ff" d="M48 30 280 256 48 482a28 28 0 0 1-16-26V56a28 28 0 0 1 16-26z" />
      <path fill="#00e676" d="M48 30a28 28 0 0 1 28 2l254 146-72 78z" />
      <path fill="#ffd400" d="M422 178l66 38c30 17 30 59 0 76l-66 38-78-78z" />
      <path fill="#ff3d57" d="M48 482a28 28 0 0 0 28-2l254-146-72-78z" />
    </svg>
    <div style={{ textAlign: 'left', fontFamily: FONTS.body, color: '#fff' }}>
      <div style={{ fontSize: 20, opacity: 0.85, letterSpacing: 1 }}>GET IT ON</div>
      <div style={{ fontSize: 38, fontWeight: 600, lineHeight: 1.05 }}>Google Play</div>
    </div>
  </div>
);

// Closing card: wordmark, headline, optional sub, app-store badges, and an
// optional QR (pre-rendered to a data URL by reel.mjs).
export const CtaBeat: React.FC<{ beat: CtaBeatData; theme: 'light' | 'dark'; safeZone: SafeZone }> = ({ beat, theme, safeZone }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 24 });
  const badgesOpacity = interpolate(frame, [16, 34], [0, 1], { extrapolateRight: 'clamp' });
  const badges = beat.badges ?? ['appstore', 'googleplay'];

  return (
    <AbsoluteFill style={{ background: background(theme), justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ transform: `translateY(${usableCenterOffset(safeZone) + (1 - enter) * 30}px)`, width: '84%', textAlign: 'center', opacity: enter }}>
        <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 34, letterSpacing: 4, color: accentFor(theme), marginBottom: 30 }}>GRITTY</div>
        <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 78, lineHeight: 1.06, letterSpacing: -1.5, color: textColor(theme) }}>{beat.headline}</div>
        {beat.sub ? <div style={{ fontFamily: FONTS.body, fontWeight: 400, fontSize: 38, lineHeight: 1.25, color: textColor(theme), opacity: 0.8, marginTop: 22 }}>{beat.sub}</div> : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center', marginTop: 48, opacity: badgesOpacity }}>
          {badges.includes('appstore') ? <AppleBadge /> : null}
          {badges.includes('googleplay') ? <GooglePlayBadge /> : null}
        </div>
        {beat.qrDataUrl ? (
          <div style={{ marginTop: 44, display: 'inline-block', background: '#fff', padding: 18, borderRadius: 22, opacity: badgesOpacity }}>
            <Img src={beat.qrDataUrl} style={{ width: 200, height: 200, display: 'block' }} />
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
