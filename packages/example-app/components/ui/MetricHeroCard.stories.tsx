import type { Meta, StoryObj } from "@storybook/react-native";

import { MetricHeroCard } from "./MetricHeroCard";

const meta = {
  component: MetricHeroCard,
  args: {
    backgroundColor: "#FFFFFF",
    shadowColor: "rgba(0,0,0,0.12)",
    eyebrow: "Session taps",
    eyebrowColor: "#687076",
    value: 42,
    valueColor: "#11181C",
    description: "Native controls, predictable state, clean screenshots.",
    descriptionColor: "#687076",
  },
} satisfies Meta<typeof MetricHeroCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
