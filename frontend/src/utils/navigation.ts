/** Minimal navigation surface needed by goHomeAndReset (avoids threading typed param lists). */
interface ResettableNavigation {
  getParent: () => { navigate: (name: string, params?: object) => void } | undefined;
  popToTop: () => void;
}

/**
 * Finish a workout flow: reset the originating stack to its root, then switch to
 * the Home tab. Resetting matters because workout summary / import-preview screens
 * are pushed onto whichever tab's stack the user came from — without popToTop they
 * stay mounted and reappear when the user returns to that tab.
 */
export function goHomeAndReset(navigation: ResettableNavigation): void {
  const parent = navigation.getParent();
  navigation.popToTop();
  parent?.navigate('Home', { screen: 'HomeMain' });
}
