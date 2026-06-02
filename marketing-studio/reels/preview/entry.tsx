import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { Player } from '@remotion/player';
import { SingleHero } from '../src/SingleHero';
import { StoryReel } from '../src/StoryReel';

// Map composition id -> component. Typed loosely: the Player is driven by
// server-resolved inputProps (the same object the renderer uses), not by a
// statically-known prop type here.
const COMPONENTS: Record<string, React.FC<any>> = { SingleHero, StoryReel };

type PreviewSpec = {
  compositionId: string;
  inputProps: Record<string, unknown>;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
};

const placeholder: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#9a9aab',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  fontSize: 16,
};

function Preview() {
  const [spec, setSpec] = useState<PreviewSpec | null>(null);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'preview') setSpec(e.data.payload as PreviewSpec);
    };
    window.addEventListener('message', onMsg);
    // Tell the dashboard we're ready to receive a spec.
    window.parent?.postMessage({ type: 'preview-ready' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  if (!spec) return <div style={placeholder}>Press “Preview” to load the reel…</div>;
  const Comp = COMPONENTS[spec.compositionId];
  if (!Comp) return <div style={placeholder}>Unknown composition “{spec.compositionId}”</div>;

  return (
    <Player
      // key forces a fresh Player when the duration/composition changes.
      key={`${spec.compositionId}-${spec.durationInFrames}`}
      component={Comp}
      inputProps={spec.inputProps}
      durationInFrames={spec.durationInFrames}
      fps={spec.fps}
      compositionWidth={spec.width}
      compositionHeight={spec.height}
      style={{ width: '100%', height: '100%' }}
      controls
      loop
      autoPlay
      acknowledgeRemotionLicense
    />
  );
}

createRoot(document.getElementById('root')!).render(<Preview />);
