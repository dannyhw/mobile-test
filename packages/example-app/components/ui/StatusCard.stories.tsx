import type { Meta, StoryObj } from "@storybook/react-native";

import { StatusCard } from "./StatusCard";

const meta = {
  component: StatusCard,
  args: {
    label: "Status",
    value: "Submitted: Danny",
    timestamp: "10:34:18",
  },
} satisfies Meta<typeof StatusCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutTimestamp: Story = {
  args: {
    timestamp: undefined,
    value: "Ready",
  },
};
