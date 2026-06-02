import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';

// Loaded at module eval so every composition renders with the actual faces (no
// system-fallback flash). Space Grotesk for display/captions, Inter for body.
// Latin-only subset keeps font fetches small.
const { fontFamily: spaceGrotesk } = loadSpaceGrotesk('normal', { weights: ['500', '700'], subsets: ['latin'] });
const { fontFamily: inter } = loadInter('normal', { weights: ['400', '600', '700'], subsets: ['latin'] });

export const FONTS = {
  display: spaceGrotesk,
  body: inter,
};
