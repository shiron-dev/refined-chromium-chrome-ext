import type { Meta, StoryObj } from "@storybook/react-vite";
import CommandPaletteScreen from "./CommandPaletteScreen";

const meta = {
  title: "Modules/CommandPalette/CommandPaletteScreen",
  component: CommandPaletteScreen,
  parameters: {
    layout: "centered",
  },
  args: {
    onBack: () => {},
    onToggle: () => {},
  },
} satisfies Meta<typeof CommandPaletteScreen>;

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
