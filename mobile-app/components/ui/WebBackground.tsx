import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { WebTheme } from '@/constants/learniqTheme';

/**
 * The website's page background (frontend/style.css body, light theme):
 * white → cream → pale yellow at 165deg, with a gold glow in each top corner.
 * Put it first inside a screen's root view; it fills the view behind the content.
 */
export function WebBackground() {
  const [top, mid, bottom] = WebTheme.pageGradient;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <LinearGradient id="lqPage" x1="0.37" y1="0" x2="0.63" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop offset="0.45" stopColor={mid} />
          <Stop offset="1" stopColor={bottom} />
        </LinearGradient>
        {/* circle at top left, rgba(251,191,36,.2) → transparent 42% */}
        <RadialGradient id="lqGlowLeft" cx="0" cy="0" fx="0" fy="0" rx="1" ry="0.46">
          <Stop offset="0" stopColor="#fbbf24" stopOpacity="0.2" />
          <Stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
        </RadialGradient>
        {/* circle at top right, rgba(234,179,8,.16) → transparent 40% */}
        <RadialGradient id="lqGlowRight" cx="1" cy="0" fx="1" fy="0" rx="0.95" ry="0.44">
          <Stop offset="0" stopColor="#eab308" stopOpacity="0.16" />
          <Stop offset="1" stopColor="#eab308" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#lqPage)" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#lqGlowLeft)" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#lqGlowRight)" />
    </Svg>
  );
}
// .
