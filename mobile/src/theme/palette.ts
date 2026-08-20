import type { AccentTheme } from '@/types/live';

export const palette = {
  background: '#09070D',
  surface: '#15101B',
  surface2: '#201727',
  text: '#FFF7FC',
  muted: '#B9A9B8',
  pink: '#FF5FC8',
  pinkSoft: '#FF9DDA',
  violet: '#A96CFF',
  success: '#5CE1A4',
  warning: '#FFBF69',
  danger: '#FF5F7A',
  cyan: '#66E4FF',
};

export const accentByTheme: Record<AccentTheme, string> = {
  lulu: palette.pink,
  violet: palette.violet,
  rose: '#FF668C',
  cyan: palette.cyan,
};
