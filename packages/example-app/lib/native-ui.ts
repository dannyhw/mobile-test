import { useTheme } from "@react-navigation/native";
import { Color } from "expo-router";
import { type ColorValue } from "react-native";

function toColor(color: ColorValue) {
  return color as string;
}

export function useNativePalette() {
  const { colors } = useTheme();

  if (process.env.EXPO_OS === "ios") {
    return {
      tint: toColor(Color.ios.systemBlue),
      background: toColor(Color.ios.systemGroupedBackground),
      surface: toColor(Color.ios.secondarySystemGroupedBackground),
      surfaceMuted: toColor(Color.ios.tertiarySystemGroupedBackground),
      text: toColor(Color.ios.label),
      secondaryText: toColor(Color.ios.secondaryLabel),
      separator: toColor(Color.ios.separator),
      destructive: toColor(Color.ios.systemRed),
    };
  }

  return {
    tint: colors.primary,
    background: colors.background,
    surface: toColor(Color.android.dynamic.surfaceContainerLow),
    surfaceMuted: toColor(Color.android.dynamic.surfaceContainerHigh),
    text: colors.text,
    secondaryText: toColor(Color.android.dynamic.onSurfaceVariant),
    separator: colors.border,
    destructive: toColor(Color.android.dynamic.error),
  };
}
