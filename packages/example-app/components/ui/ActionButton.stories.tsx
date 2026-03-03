import type { Meta, StoryObj } from "@storybook/react-native";
import { fn } from "storybook/test";

import { ActionButton } from "./ActionButton";

const meta = {
  component: ActionButton,
  argTypes: {
    onPress: { action: "pressed" },
    variant: {
      options: ["primary", "secondary"],
      control: { type: "select" },
    },
  },
  args: {
    onPress: fn(),
    label: "Continue",
    backgroundColor: "#0A84FF",
    textColor: "#FFFFFF",
    borderColor: "#D1D1D6",
  },
} satisfies Meta<typeof ActionButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    backgroundColor: "#FFFFFF",
    textColor: "#11181C",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    label: "Submit",
    backgroundColor: "#C7C7CC",
  },
};
