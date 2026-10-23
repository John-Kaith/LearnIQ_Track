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

/**
 * How the website actually renders its light theme — the app copies these.
 * Sources: frontend/style.css (body), css/learniq-design-system.css (cards,
 * .btn-primary, .btn-secondary, tabs). Keep in sync with the website.
 */
export const WebTheme = {
  /** body: linear-gradient(165deg, #ffffff 0%, #fffbeb 45%, #fef9c3 100%) */
  pageGradient: ['#ffffff', '#fffbeb', '#fef9c3'] as const,
  /** body: gold glows, top left rgba(251,191,36,.2) and top right rgba(234,179,8,.16) */
  pageGlowLeft: 'rgba(251, 191, 36, 0.2)',
  pageGlowRight: 'rgba(234, 179, 8, 0.16)',
  /** .glass-card / .panel-header: --panel is 96% white over the cream page,
   * which looks plain white; solid here so Android shadows draw cleanly. */
  surface: '#ffffff',
  /** .glass-card border: --lq-border-accent */
  surfaceBorder: 'rgba(217, 119, 6, 0.28)',
  /** --lq-shadow-card: 0 12px 32px rgba(120, 53, 15, 0.08) */
  shadowColor: '#78350f',
  /** .btn-primary: --lq-gradient-accent (135deg) with white text */
  accentGradient: ['#fbbf24', '#eab308'] as const,
  /** Solid stand-in for the gradient (its middle) */
  accentSolid: '#f3b716',
  onAccent: '#ffffff',
  /** --lq-shadow-btn: 0 12px 28px rgba(234, 179, 8, 0.28) */
  accentShadow: '#eab308',
  /** .btn-secondary (light): pale gold pill with dark gold text */
  softBg: 'rgba(251, 191, 36, 0.18)',
  softBorder: 'rgba(217, 119, 6, 0.35)',
  softText: '#a16207',
  /** .pill (light): small gold tag, e.g. the "Subject" label on a card */
  pillBg: 'rgba(251, 191, 36, 0.16)',
  pillBorder: 'rgba(217, 119, 6, 0.24)',
  /** Light-mode status colors (style.css .status-badge and .btn-danger, light):
   * dark text on a pale tint, since the dark-theme colors wash out on white */
  success: '#166534',
  successBg: 'rgba(34, 197, 94, 0.14)',
  warning: '#92400e',
  warningBg: 'rgba(245, 158, 11, 0.16)',
  danger: '#b91c1c',
  dangerBg: 'rgba(220, 38, 38, 0.08)',
  dangerBorder: 'rgba(220, 38, 38, 0.3)',
  /** Active tab (.workspace-tab.is-active) */
  tabActiveBg: 'rgba(202, 138, 4, 0.14)',
  tabActiveBorder: 'rgba(202, 138, 4, 0.42)',
  /** Avatar circle: gradient rgba(251,191,36,.25) → rgba(234,179,8,.25) */
  avatarBg: 'rgba(245, 185, 22, 0.25)',
  /** .stat-card i: --lq-accent-violet-soft */
  statIcon: '#fbbf24',
} as const;

/** @deprecated Use LearnIQTheme.colors — kept for existing imports */
export const Colors = {
  background: LearnIQTheme.colors.background,
  backgroundSoft: LearnIQTheme.colors.backgroundSoft,
  /** Cards, like the website's white glass cards */
  surface: WebTheme.surface,
  /** Card outline, like the website's gold card border */
  cardBorder: WebTheme.surfaceBorder,
  text: LearnIQTheme.colors.textBody,
  textMuted: LearnIQTheme.colors.textMuted,
  primary: LearnIQTheme.colors.accentBlue,
  secondary: LearnIQTheme.colors.accentViolet,
  border: LearnIQTheme.colors.borderSubtle,
} as const;
// .
