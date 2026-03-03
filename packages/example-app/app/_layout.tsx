import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Color, Stack } from "expo-router";
import {
  type ColorValue,
  LogBox,
  Platform,
  useColorScheme,
} from "react-native";

function toNavigationColor(color: ColorValue) {
  return color as string;
}

LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const baseTheme = colorScheme === "dark" ? DarkTheme : DefaultTheme;
  const colors =
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

  return (
    <ThemeProvider
      value={{
        ...baseTheme,
        colors: {
          ...baseTheme.colors,
          ...colors,
        },
      }}
    >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
