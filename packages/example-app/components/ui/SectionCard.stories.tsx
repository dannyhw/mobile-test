import type { Meta, StoryObj } from "@storybook/react-native";
import { Text } from "react-native";

import { SectionCard } from "./SectionCard";
import { themeColors } from "@/lib/native-ui";

const meta = {
  component: SectionCard,
  args: {
    title: "Profile",
    description: "Reusable grouped card for form controls and content.",
  },
} satisfies Meta<typeof SectionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

export const WithContent: Story = {
  render: (args) => (
    <SectionCard {...args}>
      <Text style={{ color: themeColors.text, fontSize: 16 }}>
        Child content inside the card.
      </Text>
    </SectionCard>
  ),
};
