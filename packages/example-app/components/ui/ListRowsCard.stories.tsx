import type { Meta, StoryObj } from "@storybook/react-native";

import { ListRowsCard } from "./ListRowsCard";

const meta = {
  component: ListRowsCard,
  args: {
    backgroundColor: "#FFFFFF",
    rowBorderColor: "#E5E7EB",
    labelColor: "#11181C",
    metaColor: "#687076",
    rows: [
      { id: 0, label: "Item 0", meta: "#1" },
      { id: 1, label: "Item 1", meta: "#2" },
      { id: 2, label: "Item 2", meta: "#3" },
    ],
  },
} satisfies Meta<typeof ListRowsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
