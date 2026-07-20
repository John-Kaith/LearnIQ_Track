/**
 * LearnIQ Design System — mobile tokens (aligned with web Learning IQ benchmark).
 * Source of truth (web): frontend/css/learniq-design-system.css
 *
 * Default theme: yellow & white light. Dark palette kept for future theme toggle.
 */

export const LearnIQThemeLight = {
  colors: {
    background: '#ffffff',
    backgroundElevated: '#fffef7',
    backgroundMid: '#fffbeb',
    backgroundSoft: '#fef9c3',
    textPrimary: '#1c1917',
    textBody: '#292524',
    textSecondary: '#57534e',
    textMuted: '#78716c',
    accentBlue: '#ca8a04',
    accentBlueStrong: '#a16207',
    accentViolet: '#eab308',
    accentVioletSoft: '#fbbf24',
    accentIndigo: '#d97706',
    borderSubtle: 'rgba(120, 53, 15, 0.12)',
    borderAccent: 'rgba(217, 119, 6, 0.28)',
    borderAccentSoft: 'rgba(251, 191, 36, 0.4)',
  },
  radius: {
    xl: 22,
    lg: 16,
    md: 14,
    sm: 12,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 22,
    xl: 28,
  },
} as const;

/** Dark mode palette (optional). */
export const LearnIQThemeDark = {
  colors: {
    background: '#050b16',
    backgroundElevated: '#0a1224',
    backgroundMid: '#070d1c',
    backgroundSoft: '#0c1426',
    textPrimary: '#f8fafc',
    textBody: '#e5eefc',
    textSecondary: 'rgba(203, 213, 225, 0.88)',
    textMuted: '#98a6c4',
    accentBlue: '#60a5fa',
    accentBlueStrong: '#3b82f6',
    accentViolet: '#8b5cf6',
    accentVioletSoft: '#a78bfa',
    accentIndigo: '#6366f1',
    borderSubtle: 'rgba(148, 163, 184, 0.18)',
    borderAccent: 'rgba(99, 102, 241, 0.28)',
    borderAccentSoft: 'rgba(167, 139, 250, 0.35)',
  },
  radius: LearnIQThemeLight.radius,
  spacing: LearnIQThemeLight.spacing,
} as const;

/** Active default theme for the mobile app. */
export const LearnIQTheme = LearnIQThemeLight;

/** @deprecated Use LearnIQTheme.colors — kept for existing imports */
export const Colors = {
  background: LearnIQTheme.colors.background,
  backgroundSoft: LearnIQTheme.colors.backgroundSoft,
  text: LearnIQTheme.colors.textBody,
  textMuted: LearnIQTheme.colors.textMuted,
  primary: LearnIQTheme.colors.accentBlue,
  secondary: LearnIQTheme.colors.accentViolet,
  border: LearnIQTheme.colors.borderSubtle,
} as const;
