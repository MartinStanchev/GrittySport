import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '../constants/colors';
import { EVENT_COLOR } from '../constants/activityIcons';
import type { Achievement, AchievementType } from '../services/api';

type IconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<AchievementType, IconName> = {
  event_completion: 'trophy',
  personal_record: 'ribbon',
  milestone: 'flame',
  manual: 'bookmark',
};

const LABELS: Record<AchievementType, string> = {
  event_completion: 'Event',
  personal_record: 'Personal Record',
  milestone: 'Milestone',
  manual: 'Saved',
};

export function achievementIcon(type: AchievementType): IconName {
  return ICONS[type] ?? 'star';
}

export function achievementTypeLabel(type: AchievementType): string {
  return LABELS[type] ?? 'Achievement';
}

/** Accent color per achievement type, themed where it makes sense. */
export function achievementColor(type: AchievementType, colors: ThemeColors): string {
  switch (type) {
    case 'event_completion':
      return EVENT_COLOR;
    case 'personal_record':
      return colors.primary;
    case 'milestone':
      return colors.tertiary;
    default:
      return colors.secondary;
  }
}

/** Groups achievements newest-first under month/year headers for a section list. */
export function groupAchievementsByMonth(
  achievements: Achievement[],
): { title: string; data: Achievement[] }[] {
  const groups: { title: string; data: Achievement[] }[] = [];
  let current: { title: string; data: Achievement[] } | null = null;

  for (const a of achievements) {
    const title = new Date(a.achieved_at).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    if (!current || current.title !== title) {
      current = { title, data: [] };
      groups.push(current);
    }
    current.data.push(a);
  }
  return groups;
}
