import type { Meta, StoryObj } from "@storybook/react-native";

import { StatusCard } from "./StatusCard";

const meta = {
  component: StatusCard,
  args: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D0D7DE",
    label: "Status",
    labelColor: "#687076",
    value: "Submitted: Danny",
    valueColor: "#11181C",
    timestamp: "10:34:18",
    timestampColor: "#687076",
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
