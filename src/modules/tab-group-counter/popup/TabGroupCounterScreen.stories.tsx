import type { Meta, StoryObj } from "@storybook/react-vite";
import TabGroupCounterScreen from "./TabGroupCounterScreen";

const meta = {
  title: "Modules/TabGroupCounter/TabGroupCounterScreen",
  component: TabGroupCounterScreen,
  parameters: {
    layout: "centered",
  },
  args: {
    onBack: () => {},
    onToggle: () => {},
  },
} satisfies Meta<typeof TabGroupCounterScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Enabled: Story = {
  args: {
    enabled: true,
  },
};

export const Disabled: Story = {
  args: {
    enabled: false,
  },
};
