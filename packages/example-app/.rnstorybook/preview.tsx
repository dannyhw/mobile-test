import { type Preview } from "@storybook/react-native";
import { useEffect } from "react";
import { Appearance, Platform, useColorScheme } from "react-native";
import { useGlobals } from "storybook/preview-api";

const backgroundPalette =
  Platform.OS === "ios"
    ? {
        dark: "#000000",
        light: "#FFFFFF",
        offwhite: "#F2F2F7",
      }
    : {
        dark: "#121212",
        light: "#FFFFFF",
        offwhite: "#F5F5F5",
      };

const preview: Preview = {
  decorators: [
    (Story) => {
      const colorScheme = useColorScheme();
      const [, updateGlobals] = useGlobals();
      useEffect(() => {
        updateGlobals({
          backgrounds: {
            value: colorScheme === "dark" ? "dark" : "light",
          },
        });
      }, [colorScheme, updateGlobals]);

      return <Story />;
    },
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    layout: "padded",

    backgrounds: {
      options: {
        dark: {
          name: "dark",
          value: backgroundPalette.dark,
        },
        light: {
          name: "light",
          value: backgroundPalette.light,
        },
        offwhite: {
          name: "offwhite",
          value: backgroundPalette.offwhite,
        },
      },
    },
  },
  initialGlobals: {
    backgrounds: {
      value: Appearance.getColorScheme() === "dark" ? "dark" : "light",
    },
  },
};

export default preview;
