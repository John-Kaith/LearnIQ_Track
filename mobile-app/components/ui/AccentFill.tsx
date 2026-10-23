import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { WebTheme } from '@/constants/learniqTheme';

/**
 * The website's primary-button gold: --lq-gradient-accent, #fbbf24 → #eab308
 * at 135deg. Put it first inside a button (radius = the button's corner
 * radius); text on it is white, as on .btn-primary.
 */
export function AccentFill({ radius = 0 }: { radius?: number }) {
  const [from, to] = WebTheme.accentGradient;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <LinearGradient id="lqAccent" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" rx={radius} ry={radius} fill="url(#lqAccent)" />
    </Svg>
  );
}

/** Shadow under a primary button, like --lq-shadow-btn. */
export const accentShadow = {
  shadowColor: WebTheme.accentShadow,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.28,
  shadowRadius: 14,
  elevation: 4,
} as const;
// .
