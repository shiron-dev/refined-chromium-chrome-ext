import type { Meta, StoryObj } from "@storybook/react-vite";
import AutoPipOnLeaveScreen from "./AutoPipOnLeaveScreen";

const meta = {
  title: "Modules/AutoPipOnLeave/AutoPipOnLeaveScreen",
  component: AutoPipOnLeaveScreen,
  parameters: {
    layout: "centered",
  },
  args: {
    onBack: () => {},
    onToggle: () => {},
  },
} satisfies Meta<typeof AutoPipOnLeaveScreen>;

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
