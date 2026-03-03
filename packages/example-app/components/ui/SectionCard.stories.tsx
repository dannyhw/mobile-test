import type { Meta, StoryObj } from "@storybook/react-native";
import { Text } from "react-native";

import { SectionCard } from "./SectionCard";

const meta = {
  component: SectionCard,
  args: {
    backgroundColor: "#F2F2F7",
    title: "Profile",
    titleColor: "#11181C",
    description: "Reusable grouped card for form controls and content.",
    descriptionColor: "#687076",
  },
} satisfies Meta<typeof SectionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

export const WithContent: Story = {
  render: (args) => (
    <SectionCard {...args}>
      <Text style={{ color: "#11181C", fontSize: 16 }}>Child content inside the card.</Text>
    </SectionCard>
  ),
};
