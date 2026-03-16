import type { Meta, StoryObj } from "@storybook/react-vite";
import UrlCopyShortcutScreen from "./UrlCopyShortcutScreen";

const meta = {
  title: "Modules/UrlCopyShortcut/UrlCopyShortcutScreen",
  component: UrlCopyShortcutScreen,
  parameters: {
    layout: "centered",
  },
  args: {
    onBack: () => {},
    onToggle: () => {},
  },
} satisfies Meta<typeof UrlCopyShortcutScreen>;

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
