import { Img, OffthreadVideo, staticFile } from 'remotion';

export type Media = { src: string; mediaType: 'image' | 'video' };

// Fills the phone screen with an image or video. `src` is either an http URL or
// a path relative to the Remotion public/ dir (staged there by the render tool).
export const ScreenMedia: React.FC<{ media: Media }> = ({ media }) => {
  const src = media.src.startsWith('http') ? media.src : staticFile(media.src);
  const style: React.CSSProperties = { position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' };
  return media.mediaType === 'video' ? <OffthreadVideo src={src} style={style} muted /> : <Img src={src} style={style} />;
};
