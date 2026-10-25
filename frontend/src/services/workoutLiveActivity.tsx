import type { LiveActivityFactory } from 'expo-widgets';
import type { WorkoutActivityProps } from '../utils/liveActivityProps';

// Live Activities are iOS-only (see workoutLiveActivity.ios.tsx). On Android the native
// module has no LiveActivityFactory, so creating one there would throw at import time.
export const WorkoutActivity: LiveActivityFactory<WorkoutActivityProps> | null = null;
