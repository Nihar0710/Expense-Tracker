import { Dimensions, Platform, PixelRatio } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Base design width (iPhone 14 Pro = 393pt)
const BASE_W = 393;

/**
 * Scale a size proportionally to the screen width.
 * Clamped so very large tablets don't get absurd sizes.
 */
export function rs(size) {
  const scale = SCREEN_W / BASE_W;
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(Math.min(newSize, size * 1.3)));
}

/** Vertical scale — use sparingly, only for heights/vertical spacing */
export function vs(size) {
  const scale = SCREEN_H / 852; // iPhone 14 Pro height
  return Math.round(PixelRatio.roundToNearestPixel(Math.min(size * scale, size * 1.25)));
}

/** Moderately scale — blends rs and the original value (less aggressive) */
export function ms(size, factor = 0.5) {
  return size + (rs(size) - size) * factor;
}

export const SCREEN_WIDTH  = SCREEN_W;
export const SCREEN_HEIGHT = SCREEN_H;
export const IS_SMALL      = SCREEN_W < 375;   // e.g. iPhone SE, small Android
export const IS_LARGE      = SCREEN_W >= 414;  // e.g. iPhone Plus/Max, large Android

// Common spacing tokens (already scaled)
export const spacing = {
  xs:  rs(4),
  sm:  rs(8),
  md:  rs(12),
  lg:  rs(16),
  xl:  rs(20),
  xxl: rs(24),
};

// Common font sizes (already scaled)
export const fontSize = {
  xs:    ms(11),
  sm:    ms(12),
  md:    ms(14),
  base:  ms(15),
  lg:    ms(17),
  xl:    ms(20),
  xxl:   ms(24),
  hero:  ms(32),
};

// Tab bar content height (the visual bar, above the system nav bar).
// The actual total height = TAB_BAR_HEIGHT + insets.bottom (added per-screen).
// Use useTabBarHeight() hook in screens instead of this constant directly.
export const TAB_BAR_HEIGHT = rs(56);

/**
 * Hook: returns the total bottom padding a scrollable screen needs
 * so content is never hidden behind the tab bar + system nav bar.
 * Usage:  const bottomPad = useTabBarHeight();
 */
import { useSafeAreaInsets } from 'react-native-safe-area-context';
export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + insets.bottom + spacing.lg;
}

// Border radius tokens
export const radius = {
  sm:  rs(8),
  md:  rs(12),
  lg:  rs(16),
  xl:  rs(20),
  full: 9999,
};
