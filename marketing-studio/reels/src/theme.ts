// Brand palette for the reel compositions. Mirrors the app's accent (#7c5cff)
// and Space Grotesk / Inter typography vibe (system fallback for now).
export const PALETTE = {
  accent: '#7c5cff',
  accentSoft: '#a78bff',
};

export const FONT = 'Inter, "Helvetica Neue", system-ui, sans-serif';

export function background(theme: 'light' | 'dark'): string {
  return theme === 'dark'
    ? 'linear-gradient(160deg, #14101f 0%, #0c0c12 55%, #1a1330 100%)'
    : 'linear-gradient(160deg, #f3f0ff 0%, #fbfaff 55%, #ece6ff 100%)';
}

export function textColor(theme: 'light' | 'dark'): string {
  return theme === 'dark' ? '#f3f1fb' : '#1a1626';
}
