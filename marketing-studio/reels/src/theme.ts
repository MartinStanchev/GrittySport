// Branded gradient backdrop for the reel stage. Palette, fonts, and text colors
// live in brandKit.ts / fonts.ts.
export function background(theme: 'light' | 'dark'): string {
  return theme === 'dark'
    ? 'linear-gradient(160deg, #14101f 0%, #0c0c12 55%, #1a1330 100%)'
    : 'linear-gradient(160deg, #f3f0ff 0%, #fbfaff 55%, #ece6ff 100%)';
}
