import type { AccentTheme } from '@/types/live';

export const palette = {
  background: '#0D1026',
  backgroundDeep: '#080B1D',
  surface: '#151936',
  surface2: '#242553',
  glass: 'rgba(25, 30, 67, 0.78)',
  glassStrong: 'rgba(30, 35, 76, 0.92)',
  glassSoft: 'rgba(82, 73, 137, 0.18)',
  glassBorder: 'rgba(222, 207, 255, 0.18)',
  glassHighlight: 'rgba(255, 255, 255, 0.13)',
  text: '#F7F3FF',
  muted: '#B9B7D2',
  mutedStrong: '#D4CFE7',
  pink: '#D685FF',
  pinkSoft: '#F2B7FF',
  violet: '#A762FF',
  violetDeep: '#6F4FD8',
  lavender: '#CDBBFF',
  success: '#69E6C2',
  warning: '#F7D89A',
  danger: '#FF8FA8',
  cyan: '#74DDE4',
};

export const accentByTheme: Record<AccentTheme, string> = {
  lulu: palette.pink,
  violet: palette.violet,
  rose: '#F08CB6',
  cyan: palette.cyan,
};

export const luluGradients = {
  background: ['#0D1026', '#17183B', '#10132D'] as const,
  primary: ['#DFA0FF', '#C174F6', '#8E68F2'] as const,
  aurora: [
    'rgba(167,98,255,0.30)',
    'rgba(214,133,255,0.12)',
    'rgba(116,221,228,0.08)',
  ] as const,
  glass: ['rgba(66,68,126,0.54)', 'rgba(24,29,66,0.82)'] as const,
  glassSoft: ['rgba(73,72,132,0.30)', 'rgba(21,25,54,0.68)'] as const,
  mint: ['rgba(56,208,181,0.28)', 'rgba(35,99,112,0.16)'] as const,
};
