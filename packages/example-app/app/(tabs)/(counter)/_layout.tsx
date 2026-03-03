import { useTheme } from "@react-navigation/native";
import { Stack } from "expo-router/stack";

import { useNativePalette } from "../../../lib/native-ui";

export default function CounterStackLayout() {
  const { colors } = useTheme();
  const palette = useNativePalette();

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerLargeTitle: true,
        headerLargeTitleShadowVisible: false,
        headerShadowVisible: false,
        headerBlurEffect: process.env.EXPO_OS === "ios" ? "regular" : undefined,
        headerStyle: {
          backgroundColor: palette.background,
        },
        headerLargeStyle: {
          backgroundColor: process.env.EXPO_OS === "ios" ? "transparent" : palette.background,
        },
        headerLargeTitleStyle: {
          color: palette.text,
        },
        headerTitleStyle: {
          color: palette.text,
        },
        contentStyle: {
          backgroundColor: palette.background,
        },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Counter", headerLargeTitle: true }} />
    </Stack>
  );
}
