import type { ReactNode } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { palette } from '@/theme/palette';

export function LuluInput({
  label,
  hint,
  error,
  icon,
  multiline,
  style,
  ...props
}: TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
}) {
  return (
    <View>
      {label ? (
        <Text className="mb-2 text-[10px] font-black uppercase tracking-[1.5px] text-white/55">
          {label}
        </Text>
      ) : null}
      <View
        style={{
          borderColor: error ? 'rgba(255,143,168,0.45)' : palette.glassBorder,
          backgroundColor: 'rgba(8,11,29,0.44)',
        }}
        className={`flex-row ${multiline ? 'items-start' : 'items-center'} rounded-[18px] border px-4`}
      >
        {icon ? (
          <View className={multiline ? 'mt-4 mr-3' : 'mr-3'}>{icon}</View>
        ) : null}
        <TextInput
          {...props}
          multiline={multiline}
          placeholderTextColor="#7F7D9C"
          selectionColor={palette.pink}
          style={[
            {
              minHeight: multiline ? 104 : 54,
              flex: 1,
              paddingVertical: multiline ? 14 : 0,
              color: palette.text,
              fontSize: 14,
              fontWeight: '700',
              textAlignVertical: multiline ? 'top' : 'center',
            },
            style,
          ]}
        />
      </View>
      {error || hint ? (
        <Text
          style={{ color: error ? palette.danger : palette.muted }}
          className="mt-2 text-[11px] leading-4"
        >
          {error || hint}
        </Text>
      ) : null}
    </View>
  );
}
