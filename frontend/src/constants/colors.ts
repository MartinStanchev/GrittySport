export interface ThemeColors {
  primary: string;
  primaryLight: string;
  secondary: string;
  tertiary: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  glass: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  tabActive: string;
  tabInactive: string;
  tabBarBorder: string;
  tabBarBackground: string;
  inputBackground: string;
  messageBubble: string;
  overlay: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export const LightColors: ThemeColors = {
  primary: '#7C5CFC',
  primaryLight: '#EDE9FF',
  secondary: '#0EA5B0',
  tertiary: '#E68A2E',
  background: '#F5F3FF',
  surface: '#FFFFFF',
  surfaceAlt: '#EDE9FF',
  glass: 'rgba(124, 92, 252, 0.06)',
  textPrimary: '#1A1A2E',
  textSecondary: '#6B6B7B',
  border: '#DDD8F0',
  tabActive: '#7C5CFC',
  tabInactive: '#9E9EAE',
  tabBarBorder: '#DDD8F0',
  tabBarBackground: '#FFFFFF',
  inputBackground: '#FFFFFF',
  messageBubble: '#FFFFFF',
  overlay: 'rgba(26, 26, 46, 0.35)',
  success: '#34C759',
  warning: '#E68A2E',
  error: '#DC3545',
  info: '#0EA5B0',
};

export const DarkColors: ThemeColors = {
  primary: '#cebdff',
  primaryLight: '#2A2440',
  secondary: '#46eaed',
  tertiary: '#ffb868',
  background: '#12121d',
  surface: '#1f1e2a',
  surfaceAlt: '#383845',
  glass: 'rgba(31, 30, 42, 0.6)',
  textPrimary: '#e3e0f1',
  textSecondary: '#cbc3d9',
  border: '#2e2d3a',
  tabActive: '#cebdff',
  tabInactive: '#6B6B7B',
  tabBarBorder: '#2e2d3a',
  tabBarBackground: '#181723',
  inputBackground: '#383845',
  messageBubble: '#1f1e2a',
  overlay: 'rgba(0, 0, 0, 0.55)',
  success: '#46eaed',
  warning: '#ffb868',
  error: '#ffb4ab',
  info: '#46eaed',
};

export const Colors = LightColors;
