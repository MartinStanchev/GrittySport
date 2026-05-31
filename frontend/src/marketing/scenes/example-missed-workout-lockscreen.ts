import type { Scene } from '../types';

export const exampleMissedWorkoutLockscreenScene: Scene = {
  id: 'example-missed-workout-lockscreen',
  title: 'Example · Missed workout · lockscreen',
  group: 'Examples (web)',
  device: 'iphone-15-pro',
  kind: 'lockscreen',
  props: {
    // Placeholder wallpaper so the scene compiles + renders. Swap this require
    // for a real phone wallpaper (drop one in assets/) before capturing.
    wallpaper: require('../../../assets/splash-icon.png'),
    time: '7:14',
    date: 'Wednesday, May 27',
    battery: 78,
    notifications: [
      {
        appName: 'Gritty',
        title: 'Yesterday got away from you',
        body: "Tuesday's threshold run is still open. No stress — want to slot it in today or shuffle the week? Tap to sort it out.",
        timeAgo: 'now',
      },
    ],
  },
};
