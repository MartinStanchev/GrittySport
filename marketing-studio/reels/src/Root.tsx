import { Composition } from 'remotion';
import { SingleHero, type SingleHeroProps } from './SingleHero';
import { StoryReel, type StoryReelProps } from './StoryReel';

const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SingleHero"
        component={SingleHero}
        fps={FPS}
        width={1080}
        height={1920}
        durationInFrames={240}
        defaultProps={
          {
            media: { src: 'sample-lockscreen.png', mediaType: 'image' },
            headline: 'Accountability that texts you back.',
            theme: 'dark',
            durationInFrames: 240,
            motion: 'float',
          } satisfies SingleHeroProps
        }
        calculateMetadata={({ props }) => ({ durationInFrames: props.durationInFrames })}
      />

      <Composition
        id="StoryReel"
        component={StoryReel}
        fps={FPS}
        width={1080}
        height={1920}
        durationInFrames={420}
        defaultProps={
          {
            theme: 'dark',
            transitionFrames: 16,
            transition: 'slide',
            motion: 'float',
            beats: [
              { media: { src: 'sample-lockscreen.png', mediaType: 'image' }, caption: 'Grit notices when you miss.', durationInFrames: 90 },
              { media: { src: 'sample-replay.mp4', mediaType: 'video' }, caption: 'And starts the conversation.', durationInFrames: 240 },
              { media: { src: 'sample-week.png', mediaType: 'image' }, caption: 'Your whole week, adjusted.', durationInFrames: 120 },
            ],
          } satisfies StoryReelProps
        }
        calculateMetadata={({ props }) => ({
          durationInFrames:
            props.beats.reduce((sum, b) => sum + b.durationInFrames, 0) - (props.beats.length - 1) * props.transitionFrames,
        })}
      />
    </>
  );
};
