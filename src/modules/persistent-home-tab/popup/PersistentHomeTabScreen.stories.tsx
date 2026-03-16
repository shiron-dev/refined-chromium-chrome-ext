import type { Meta, StoryObj } from "@storybook/react-vite";
import PersistentHomeTabScreen from "./PersistentHomeTabScreen";

const meta = {
  title: "Modules/PersistentHomeTab/PersistentHomeTabScreen",
  component: PersistentHomeTabScreen,
  parameters: {
    layout: "centered",
  },
  args: {
    onBack: () => {},
    onToggle: () => {},
  },
} satisfies Meta<typeof PersistentHomeTabScreen>;

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
