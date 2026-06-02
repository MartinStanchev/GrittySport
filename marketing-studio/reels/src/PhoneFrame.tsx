import type { ReactNode } from 'react';

// Aspect of the app's web captures (393×852). The screen area matches this so
// screenshots/videos fill it with no crop.
const SCREEN_ASPECT = 393 / 852;

export const PhoneFrame: React.FC<{
  children: ReactNode;
  screenHeight?: number;
  bezel?: number;
  island?: boolean;
  // Off by default: our captures already include their own top UI (status bar /
  // chat header), so an overlaid island double-ups or covers content.
}> = ({ children, screenHeight = 1500, bezel = 18, island = false }) => {
  const screenWidth = Math.round(screenHeight * SCREEN_ASPECT);
  const screenRadius = Math.round(screenWidth * 0.14);
  const outerRadius = screenRadius + bezel;
  const islandW = Math.round(screenWidth * 0.3);
  const islandH = Math.round(screenWidth * 0.085);

  return (
    <div style={{ position: 'relative', width: screenWidth + bezel * 2, height: screenHeight + bezel * 2 }}>
      {/* Titanium frame */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: outerRadius,
          padding: bezel,
          background: 'linear-gradient(150deg, #45454e 0%, #202027 42%, #141419 100%)',
          boxShadow: '0 40px 90px rgba(0,0,0,0.45), inset 0 0 0 2px rgba(255,255,255,0.06)',
        }}
      >
        {/* Screen */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: screenRadius,
            overflow: 'hidden',
            background: '#000',
          }}
        >
          {children}
          {island && (
            <div
              style={{
                position: 'absolute',
                top: Math.round(screenWidth * 0.035),
                left: '50%',
                transform: 'translateX(-50%)',
                width: islandW,
                height: islandH,
                background: '#000',
                borderRadius: 999,
                zIndex: 5,
              }}
            />
          )}
        </div>
      </div>

      {/* Side buttons */}
      <div style={{ position: 'absolute', left: -3, top: '25%', width: 5, height: '6%', borderRadius: 3, background: '#2a2a30' }} />
      <div style={{ position: 'absolute', left: -3, top: '34%', width: 5, height: '6%', borderRadius: 3, background: '#2a2a30' }} />
      <div style={{ position: 'absolute', right: -3, top: '29%', width: 5, height: '10%', borderRadius: 3, background: '#2a2a30' }} />
    </div>
  );
};
