import { Composition } from 'remotion';
import { SingleHero, type SingleHeroProps } from './SingleHero';
import { StoryReel, type StoryReelProps } from './StoryReel';
import { storyDurationInFrames } from './metadata';

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
            safeZone: 'none',
            showSafeZones: false,
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
            captionPreset: 'pop',
            safeZone: 'none',
            showSafeZones: false,
            beats: [
              { kind: 'hook', kicker: 'Missed a workout?', text: 'Grit texts you back.', durationInFrames: 75 },
              { kind: 'media', media: { src: 'sample-lockscreen.png', mediaType: 'image' }, caption: 'It notices when you miss.', durationInFrames: 90 },
              { kind: 'media', media: { src: 'sample-replay.mp4', mediaType: 'video' }, caption: 'And starts the conversation.', durationInFrames: 240 },
              { kind: 'stat', value: 7, label: 'sessions adjusted this week', prefix: '', suffix: '', durationInFrames: 84 },
              { kind: 'cta', headline: 'Train with Grit.', sub: 'Your AI coach, free to start.', badges: ['appstore', 'googleplay'], durationInFrames: 120 },
            ],
          } satisfies StoryReelProps
        }
        calculateMetadata={({ props }) => ({
          durationInFrames: storyDurationInFrames(props.beats, props.transitionFrames, props.transition),
        })}
      />
    </>
  );
};
