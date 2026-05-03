// Sport chips used in program creation and anywhere a user picks a primary sport.
// `skill` matches the backend skill key in `backend/prompts/skills/*.md` so Grit
// can early-load the right intake guidance. `null` means no dedicated skill exists.
export interface SportOption {
  label: string;
  skill: string | null;
}

export const SPORT_OPTIONS: SportOption[] = [
  { label: 'Running', skill: 'running' },
  { label: 'Cycling', skill: 'cycling' },
  { label: 'Swimming', skill: 'swimming' },
  { label: 'Strength', skill: 'strength_training' },
  { label: 'Powerlifting', skill: 'powerlifting' },
  { label: 'Triathlon', skill: 'triathlon' },
  { label: 'General Fitness', skill: 'general_fitness' },
  { label: 'Yoga', skill: null },
  { label: 'CrossFit', skill: null },
  { label: 'Other', skill: null },
];

export const SPORT_LABELS: string[] = SPORT_OPTIONS.map(s => s.label);

// Race/event presets shown in goal-mode = event. "Other" lets the user just pick a date.
export const RACE_EVENTS: string[] = [
  '5K',
  '10K',
  'Half Marathon',
  'Marathon',
  'Triathlon',
  'Ironman',
  'Hyrox',
  'Powerlifting Meet',
  'Century Ride',
  'Other',
];

// Common phase structures the user can apply with one tap.
export interface PhasePreset {
  id: string;
  label: string;
  phases: { name: string; weeks: number }[] | null; // null = "Custom" (no-op)
}

export const PHASE_PRESETS: PhasePreset[] = [
  { id: 'bbp', label: 'Base / Build / Peak', phases: [
    { name: 'Base', weeks: 5 },
    { name: 'Build', weeks: 4 },
    { name: 'Peak', weeks: 3 },
  ] },
  { id: 'foundation_race', label: 'Foundation + Race Prep', phases: [
    { name: 'Foundation', weeks: 8 },
    { name: 'Race Prep', weeks: 4 },
  ] },
  { id: 'single', label: 'Single Block', phases: [
    { name: 'Training', weeks: 8 },
  ] },
  { id: 'custom', label: 'Custom', phases: null },
];

// Per-phase color used to visually distinguish phases in the builder and review.
// Cycles through this list by phase index.
export const PHASE_COLORS = ['#7C5CFC', '#0EA5B0', '#E68A2E', '#34C759'];
