import { Colors } from '@/constants/colors';

export function useThemeColor(
  _props: { light?: string; dark?: string },
  colorName: keyof typeof Colors,
) {
  return Colors[colorName];
}
