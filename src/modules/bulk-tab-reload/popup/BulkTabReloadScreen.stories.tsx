import type { Meta, StoryObj } from "@storybook/react-vite";
import BulkTabReloadScreen from "./BulkTabReloadScreen";

const meta = {
  title: "Modules/BulkTabReload/BulkTabReloadScreen",
  component: BulkTabReloadScreen,
  parameters: {
    layout: "centered",
  },
  args: {
    onBack: () => {},
    onToggle: () => {},
  },
} satisfies Meta<typeof BulkTabReloadScreen>;

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
