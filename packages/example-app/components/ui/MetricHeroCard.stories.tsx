import type { Meta, StoryObj } from "@storybook/react-native";

import { MetricHeroCard } from "./MetricHeroCard";

const meta = {
  component: MetricHeroCard,
  args: {
    eyebrow: "Session taps",
    value: 42,
    description: "Native controls, predictable state, clean screenshots.",
  },
} satisfies Meta<typeof MetricHeroCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
