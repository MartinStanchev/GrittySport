import type { Scene } from '../types';

// Reel 1, mid-story — the anti-ChatGPT-copy-paste hook. You finish the interval
// ride, lock the phone, and the review arrives on its own, already aware of the
// same session three weeks ago. Nothing was exported, pasted, or explained.
export const postNoPasting1LockscreenScene: Scene = {
  id: 'post-no-pasting-1-lockscreen',
  title: 'Post · No pasting · ride review lockscreen',
  group: 'Social posts',
  device: 'iphone-15-pro',
  kind: 'lockscreen',
  props: {
    // Placeholder wallpaper so the scene compiles + renders. Swap this require
    // for a real phone wallpaper (drop one in assets/) before capturing.
    wallpaper: require('../../../assets/splash-icon.png'),
    time: '18:42',
    date: 'Wednesday, August 26',
    battery: 74,
    notifications: [
      {
        appName: 'Gritty',
        title: 'Interval ride reviewed',
        body: 'Held 245W across all 4 reps, up from 228W three weeks ago.',
        timeAgo: 'now',
      },
    ],
  },
};
