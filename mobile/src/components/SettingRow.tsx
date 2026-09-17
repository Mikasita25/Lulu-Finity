import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { LuluSwitch } from './LuluSwitch';
import { palette } from '@/theme/palette';

export function SettingRow({
  title,
  subtitle,
  value,
  onValueChange,
  icon,
  last = false,
  disabled = false,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon?: ReactNode;
  last?: boolean;
  disabled?: boolean;
}) {
  return (
    <View
      style={{
        borderBottomColor: palette.glassBorder,
        borderBottomWidth: last ? 0 : 1,
      }}
      className="flex-row items-center gap-3 py-4"
    >
      {icon ? (
        <View className="h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.055]">
          {icon}
        </View>
      ) : null}
      <View className="flex-1">
        <Text className="text-sm font-extrabold text-white">{title}</Text>
        {subtitle ? (
          <Text className="mt-1 text-xs leading-5 text-white/55">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <LuluSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={`${value ? 'Desactivar' : 'Activar'} ${title}`}
      />
    </View>
  );
}
