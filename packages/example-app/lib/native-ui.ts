import { useTheme } from "@react-navigation/native";
import { Color } from "expo-router";
import { Platform, type ColorValue } from "react-native";

function toNavigationColor(color: ColorValue) {
  return color as string;
}

export const themeColors =
  Platform.OS === "ios"
    ? {
        primary: toNavigationColor(Color.ios.systemBlue),
        background: toNavigationColor(Color.ios.systemBackground),
        card: toNavigationColor(Color.ios.secondarySystemBackground),
        text: toNavigationColor(Color.ios.label),
        border: toNavigationColor(Color.ios.separator),
        notification: toNavigationColor(Color.ios.systemRed),
      }
    : {
        primary: toNavigationColor(Color.android.dynamic.primary),
        background: toNavigationColor(Color.android.dynamic.surface),
        card: toNavigationColor(Color.android.dynamic.surfaceContainer),
        text: toNavigationColor(Color.android.dynamic.onSurface),
        border: toNavigationColor(Color.android.dynamic.outlineVariant),
        notification: toNavigationColor(Color.android.dynamic.error),
      };

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
