import AsyncStorage from "@react-native-async-storage/async-storage";
import { view } from "./storybook.requires";
import { LiteUI } from "@storybook/react-native-ui-lite";
import { SafeAreaView } from "react-native-safe-area-context";
const StorybookUIRoot = view.getStorybookUI({
  storage: {
    getItem: AsyncStorage.getItem,
    setItem: AsyncStorage.setItem,
  },
  CustomUIComponent: ({ children, story }) => (
    <SafeAreaView
      style={{ flex: 1 }}
      testID={story?.id ?? "storybook-root-container"}
    >
      {children}
    </SafeAreaView>
  ),
  enableWebsockets: true,
});

export default StorybookUIRoot;
