import type { UserResponse } from '../services/api';

export function isPremium(user: UserResponse | null | undefined): boolean {
  return user?.subscription_tier === 'premium';
}
