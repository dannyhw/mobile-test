import { themeColors } from "@/lib/native-ui";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { LogBox, useColorScheme } from "react-native";

LogBox.ignoreAllLogs(true);

export const unstable_settings = {
  initialRouteName: "(tabs)/counter/index",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const baseTheme = colorScheme === "dark" ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...baseTheme,
        colors: {
          ...baseTheme.colors,
          ...themeColors,
        },
      }}
    >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        <Stack.Screen
          name="(storybook)/index"
          options={{ title: "Storybook", headerShown: false }}
        />
      </Stack>
    </ThemeProvider>
  );
}
