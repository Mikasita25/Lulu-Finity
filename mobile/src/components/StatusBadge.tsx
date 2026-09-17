import { Text, View } from 'react-native';
import { palette } from '@/theme/palette';

const toneColors = {
  neutral: {
    dot: '#8585A9',
    text: '#C9C7DC',
    bg: 'rgba(255,255,255,0.045)',
    border: 'rgba(255,255,255,0.10)',
  },
  success: {
    dot: palette.success,
    text: '#9EF2DC',
    bg: 'rgba(40,207,174,0.10)',
    border: 'rgba(105,230,194,0.24)',
  },
  warning: {
    dot: palette.warning,
    text: '#FAE6B8',
    bg: 'rgba(247,216,154,0.08)',
    border: 'rgba(247,216,154,0.22)',
  },
  danger: {
    dot: palette.danger,
    text: '#FFB8C8',
    bg: 'rgba(255,143,168,0.09)',
    border: 'rgba(255,143,168,0.22)',
  },
};

export function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: keyof typeof toneColors;
}) {
  const colors = toneColors[tone];
  return (
    <View
      style={{ backgroundColor: colors.bg, borderColor: colors.border }}
      className="flex-row items-center gap-2 rounded-full border px-3 py-2"
    >
      <View
        style={{ backgroundColor: colors.dot }}
        className="h-2 w-2 rounded-full"
      />
      <Text
        style={{ color: colors.text }}
        className="text-[10px] font-black uppercase tracking-[1px]"
      >
        {label}
      </Text>
    </View>
  );
}
