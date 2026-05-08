const DEFAULT_WEB_URL = 'https://grittyfitness.app';

const baseUrl = (process.env.EXPO_PUBLIC_WEB_URL ?? DEFAULT_WEB_URL).replace(/\/$/, '');

export const LEGAL_URLS = {
  impressum: `${baseUrl}/impressum`,
  datenschutz: `${baseUrl}/datenschutz`,
  agb: `${baseUrl}/agb`,
} as const;
