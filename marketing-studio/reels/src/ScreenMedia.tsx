import { Img, OffthreadVideo, staticFile } from 'remotion';

export type Media = { src: string; mediaType: 'image' | 'video'; playbackRate?: number };

// Fills the phone screen. `contain` (not cover) so any scene aspect — including
// 9:16 scroll videos that are wider than the phone screen — shows fully without
// being cropped by the frame. `src` is an http URL or a path relative to the
// Remotion public/ dir (staged there by the render tool).
export const ScreenMedia: React.FC<{ media: Media }> = ({ media }) => {
  const src = media.src.startsWith('http') ? media.src : staticFile(media.src);
  const style: React.CSSProperties = { position: 'absolute', width: '100%', height: '100%', objectFit: 'contain' };
  return media.mediaType === 'video' ? (
    <OffthreadVideo src={src} style={style} muted playbackRate={media.playbackRate ?? 1} />
  ) : (
    <Img src={src} style={style} />
  );
};
