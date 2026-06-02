import { FONTS } from './fonts';

// Single source of brand styling for the reel compositions.
export const PALETTE = {
  accent: '#7c5cff',
  accentSoft: '#a78bff',
  ink: '#1a1626',
  inkInverse: '#f3f1fb',
};

export function textColor(theme: 'light' | 'dark'): string {
  return theme === 'dark' ? PALETTE.inkInverse : PALETTE.ink;
}

// The accent reads better lightened on a dark gradient and saturated on light.
export function accentFor(theme: 'light' | 'dark'): string {
  return theme === 'dark' ? PALETTE.accentSoft : PALETTE.accent;
}

// How the active (most-recently-revealed) word is emphasised:
//   none  – every revealed word shares one colour (clean pop-in only)
//   dim   – past words fade back, the active word takes the accent
//   box   – the active word gets an accent pill behind white text (TikTok classic)
//   pop   – the active word scales up + takes the accent
export type CaptionHighlight = 'none' | 'dim' | 'box' | 'pop';

export type CaptionPreset = {
  label: string;
  highlight: CaptionHighlight;
  fontSize: number; // px at the 1080-wide composition
  fontWeight: number;
  letterSpacing: number;
  uppercase: boolean;
};

export const CAPTION_PRESETS: Record<string, CaptionPreset> = {
  clean: { label: 'Clean', highlight: 'none', fontSize: 56, fontWeight: 700, letterSpacing: -0.5, uppercase: false },
  karaoke: { label: 'Karaoke', highlight: 'dim', fontSize: 56, fontWeight: 700, letterSpacing: -0.5, uppercase: false },
  boxed: { label: 'Boxed', highlight: 'box', fontSize: 52, fontWeight: 700, letterSpacing: 0, uppercase: true },
  pop: { label: 'Pop', highlight: 'pop', fontSize: 58, fontWeight: 700, letterSpacing: -0.5, uppercase: false },
};

export const CAPTION_PRESET_IDS = Object.keys(CAPTION_PRESETS);
export const DEFAULT_CAPTION_PRESET = 'clean';

export type ResolvedCaptionStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  lineHeight: number;
  uppercase: boolean;
  highlight: CaptionHighlight;
  baseColor: string; // revealed, non-active words
  dimColor: string; // past words when highlight === 'dim'
  activeColor: string; // active word text
  boxColor: string; // active-word pill when highlight === 'box'
};

export function resolveCaptionStyle(presetId: string, theme: 'light' | 'dark'): ResolvedCaptionStyle {
  const preset = CAPTION_PRESETS[presetId] ?? CAPTION_PRESETS[DEFAULT_CAPTION_PRESET];
  const base = textColor(theme);
  const accent = accentFor(theme);
  return {
    fontFamily: FONTS.display,
    fontSize: preset.fontSize,
    fontWeight: preset.fontWeight,
    letterSpacing: preset.letterSpacing,
    lineHeight: 1.12,
    uppercase: preset.uppercase,
    highlight: preset.highlight,
    baseColor: base,
    dimColor: theme === 'dark' ? 'rgba(243,241,251,0.45)' : 'rgba(26,22,38,0.42)',
    activeColor: preset.highlight === 'box' ? '#ffffff' : accent,
    boxColor: PALETTE.accent,
  };
}
