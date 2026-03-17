export interface ThemeColors {
  primary: string;
  primaryLight: string;
  background: string;
  surface: string;
  surfaceAlt: string;
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
  primary: '#E63946',
  primaryLight: '#FEE2E5',
  background: '#F8F8F8',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F0F0',
  textPrimary: '#1A1A1A',
  textSecondary: '#666666',
  border: '#E0E0E0',
  tabActive: '#E63946',
  tabInactive: '#999999',
  tabBarBorder: '#E0E0E0',
  tabBarBackground: '#FFFFFF',
  inputBackground: '#FFFFFF',
  messageBubble: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.35)',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
};

export const DarkColors: ThemeColors = {
  primary: '#E63946',
  primaryLight: '#3D1A1E',
  background: '#121212',
  surface: '#1E1E1E',
  surfaceAlt: '#2A2A2A',
  textPrimary: '#F0F0F0',
  textSecondary: '#9E9E9E',
  border: '#333333',
  tabActive: '#E63946',
  tabInactive: '#777777',
  tabBarBorder: '#333333',
  tabBarBackground: '#1A1A1A',
  inputBackground: '#2A2A2A',
  messageBubble: '#2A2A2A',
  overlay: 'rgba(0,0,0,0.55)',
  success: '#66BB6A',
  warning: '#FFA726',
  error: '#EF5350',
  info: '#42A5F5',
};

// Default export for backwards compatibility during migration
export const Colors = LightColors;
